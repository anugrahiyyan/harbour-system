/**
 * Server.js Script
 * ------------------------------------
 * Handles:
 *  - HTTP server with Express
 *  - REST API for ship records and access codes
 *  - SSE for real-time updates to manager dashboard
 *  - Data persistence in JSON files
 *  - Session management for manager authentication
 *  - OTP (one-time password) code generation and validation
 *  - Client-side static file serving
 *  - CORS and security headers
 *  - Logging and error handling
 * ------------------------------------
 * Author: anugrahiyyan (@gbtr.x)
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT;

const FileStore = require('session-file-store')(session);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(cookieParser());
app.set('trust proxy', 1); // trust first proxy if behind one 

// Session setup
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'data/sessions'),
    retries: 1,          // minimize retry storms on Windows
    reapInterval: 3600,    // cleanup interval (seconds)
    ttl: 86400           // 1 day
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: false,       // still allow http://localhost
    sameSite: 'lax',
    maxAge: 86400000
  }
}));

const DATA_DIR = path.join(__dirname, 'data');
const SHIPS_FILE = path.join(DATA_DIR, 'ships.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]');
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();

    if (!raw) {
      fs.writeFileSync(filePath, '[]');
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch {
      console.warn(`⚠️ Corrupted JSON in ${path.basename(filePath)}, resetting...`);
      fs.writeFileSync(filePath, '[]');
      return [];
    }
  } catch (err) {
    console.error('readJson error', err);
    return [];
  }
}

function writeJson(filePath, data){
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch(e){
    console.error('writeJson error', e);
    return false;
  }
}

// SSE clients
let sseClients = [];
function sendEventToAll(eventName, payload) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(res => {
    try { res.write(data); } catch(_) {}
  });
}
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === MANAGER_PASSWORD) {
    req.session.manager = true;
    req.session.save(err => {
      if (err) console.error('Session save error:', err);
      else console.log('✅ Session saved successfully:', req.session.id);
      return res.json({ ok: true });
    });
    return;
  }
  console.log('❌ Invalid password attempt');
  return res.status(401).json({ ok: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => { res.json({ ok:true }); });
});

function requireManager(req, res, next){
  if(req.session && req.session.manager) return next();
  return res.status(401).json({ ok:false });
}

// Simple check manager
// This endpoint checks if the current session is authenticated as manager.
// Uses requireManager middleware for consistency.
app.get('/api/check-manager', requireManager, (req, res) => {
  return res.json({ ok: true });
});

// ---------------- SHIPS ----------------

// Get all ships (optionally filter by status)
app.get('/api/ships', (req, res) => {
  const ships = readJson(SHIPS_FILE);
  const { status } = req.query;
  if (status) return res.json(ships.filter(s => s.status === status));
  res.json(ships);
});

// Add new ship
app.post('/api/ships', (req, res) => {
  const {
    shipName, shipType, shipCode,
    cargoType, cargoSubType, cargoDetails, cargoAmount, arrivalDate
  } = req.body;

  if (!shipName || !cargoType || !cargoDetails)
    return res.status(400).json({ ok: false, message: 'Missing fields' });

  const ships = readJson(SHIPS_FILE);
  const newShip = {
    id: Date.now(),
    shipName,
    shipType: shipType || 'Unknown',
    shipCode: shipCode || '',
    cargoType,
    cargoSubType: cargoSubType || '',
    cargoDetails,
    cargoAmount: cargoAmount || 0,
    arrivalDate: arrivalDate || new Date().toISOString().split('T')[0],
    status: 'pending',
    created_at: new Date().toISOString()
  };

  ships.push(newShip);
  writeJson(SHIPS_FILE, ships);

  // SSE broadcast: new-ship
  sendEventToAll('new-ship', newShip);

  res.json({ ok: true, ship: newShip });
});

// Approve / reject ship
app.put('/api/ships/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const ships = readJson(SHIPS_FILE);
  const idx = ships.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ ok: false });
  ships[idx].status = status;
  ships[idx].updated_at = new Date().toISOString();
  writeJson(SHIPS_FILE, ships);

  // SSE broadcast: update-ship
  sendEventToAll('update-ship', ships[idx]);

  res.json({ ok: true, ship: ships[idx] });
});

// ---------------- CODES ----------------
app.get('/api/codes', requireManager, (req, res) => {
  const codes = readJson(CODES_FILE);
  res.json(codes);
});
app.post('/api/codes', requireManager, (req, res) => {
  const { ttlSeconds } = req.body;
  const codes = readJson(CODES_FILE);
  const code = (Math.floor(100000 + Math.random()*900000)).toString();
  const entry = { id: uuidv4(), code, used:false, created_at: new Date().toISOString(), expires_at: Date.now() + (Number(ttlSeconds)||3600)*1000 };
  codes.push(entry);
  writeJson(CODES_FILE, codes);

  // SSE broadcast: codes-updated
  sendEventToAll('codes-updated', entry);

  res.json({ ok:true, code: entry });
});
app.put('/api/codes/:id', requireManager, (req, res) => {
  const id = req.params.id; const { action } = req.body;
  const codes = readJson(CODES_FILE);
  const idx = codes.findIndex(c=>c.id===id);
  if(idx===-1) return res.status(404).json({ ok:false });
  if(action==='extend'){ codes[idx].expires_at = Date.now() + 3600*1000; }
  else if(action==='delete'){ const deleted = codes.splice(idx,1); writeJson(CODES_FILE,codes);
    // remove sessions tied to that code
    let sessions = readJson(SESSIONS_FILE);
    sessions = sessions.filter(s=>s.code !== deleted[0].code);
    writeJson(SESSIONS_FILE, sessions);
    // broadcast
    sendEventToAll('codes-updated', { deleted: deleted[0] });
    return res.json({ ok:true, deleted: deleted[0] });
  } else if(action==='mark_used'){ codes[idx].used = true; }
  writeJson(CODES_FILE, codes);

  sendEventToAll('codes-updated', codes[idx]);

  res.json({ ok:true, code: codes[idx] });
});

// ---------------- SESSIONS ----------------
app.post('/api/validate-code', (req, res) => {
  const { code } = req.body;
  const codes = readJson(CODES_FILE);
  const entry = codes.find(c=>c.code===code && c.expires_at > Date.now());
  if(!entry) return res.status(400).json({ ok:false, message:'Invalid or expired' });
  // mark used
  entry.used = true;
  writeJson(CODES_FILE, codes);
  // create session token
  const sessions = readJson(SESSIONS_FILE);
  const token = uuidv4();
  const sessionEntry = { token, code: entry.code, created_at: Date.now(), expires_at: entry.expires_at };
  sessions.push(sessionEntry);
  writeJson(SESSIONS_FILE, sessions);

  // broadcast codes-updated (entry used)
  sendEventToAll('codes-updated', entry);

  res.json({ ok:true, sessionToken: token });
});

// Check active session token validity
app.post('/api/check-active-code', (req, res) => {
  const { sessionToken } = req.body;
  if(!sessionToken) return res.json({ ok:false });
  let sessions = readJson(SESSIONS_FILE);

  // auto cleanup expired
  const now = Date.now();
  sessions = sessions.filter(s => s.expires_at > now);
  writeJson(SESSIONS_FILE, sessions);

  const s = sessions.find(x=>x.token===sessionToken);
  if(!s) return res.json({ ok:false });
  return res.json({ ok:true });
});

// ---------------- SSE endpoint ----------------
// Manager connects here to receive events
app.get('/events', (req, res) => {
  // Verify manager session
  if (!req.session.manager) {
    res.status(401).end();
    return;
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  const sendUpdate = () => {
    const ships = readJson(SHIPS_FILE);
    res.write(`data: ${JSON.stringify(ships)}\n\n`);
  };

  // Initial push
  sendUpdate();

  // Interval updates
  const interval = setInterval(sendUpdate, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// ---------------- History endpoint ----------------
// Return ships for a given date (YYYY-MM-DD). If no date, return all.
app.get('/api/history', requireManager, (req, res) => {
  const date = req.query.date; // expected YYYY-MM-DD
  const ships = readJson(SHIPS_FILE);
  if (!date) return res.json(ships);
  const matched = ships.filter(s => {
    const created = s.created_at ? s.created_at.split('T')[0] : (s.arrivalDate || '').split('T')[0];
    return created === date;
  });
  res.json(matched);
});

// ---------------- Cleanup expired sessions periodically (optional) ----------------
setInterval(() => {
  let sessions = readJson(SESSIONS_FILE);
  const now = Date.now();
  const filtered = sessions.filter(s => s.expires_at > now);
  if (filtered.length !== sessions.length) writeJson(SESSIONS_FILE, filtered);
}, 60 * 1000);

app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));