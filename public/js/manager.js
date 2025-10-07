/**
 * Manager Display Screen Script
 * ------------------------------------
 * Handles:
 *  - Generadtion, extension, deletion of one-time access codes (OTP)
 *  - Approval/rejection of incoming ship requests
 *  - Live updates via SSE
 *  - viewing history of ship requests by date
 *  - Session management for manager login
 *  - Password-protected access
 * ------------------------------------
 * Author: anugrahiyyan (@gbtr.x)
 */

const qs = (s, ctx=document) => ctx.querySelector(s);
const qsa = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

const viewLogin = qs('#viewLogin');
const appShell = qs('#appShell');
const viewDashboard = qs('#viewDashboard');
const viewHistory = qs('#viewHistory');

const navDashboard = qs('#navDashboard');
const navHistory = qs('#navHistory');
const btnLogout = qs('#btnLogout');
const managerStatus = qs('#managerStatus');

const inputPassword = qs('#inputPassword');
const btnLogin = qs('#btnLogin');
const btnCheckSession = qs('#btnCheckSession');

const pendingContainer = qs('#pendingContainer');
const decidedContainer = qs('#decidedContainer');
const codesContainer = qs('#codesContainer');
const statPending = qs('#statPending');
const statApproved = qs('#statApproved');

const btnGenerateCode = qs('#btnGenerateCode');
const btnRefreshPending = qs('#btnRefreshPending');

const historyDate = qs('#historyDate');
const btnLoadHistory = qs('#btnLoadHistory');
const btnClearHistory = qs('#btnClearHistory');
const historyTbody = qs('#historyTbody');

let es = null;
let reconnectTimer = 1000;
let lastNewId = null;

// util fetch with credentials
/**
 * Performs a fetch request with credentials included.
 * @param {string} url - The URL to fetch.
 * @param {Object} [options={}] - Optional fetch options.
 * @returns {Promise<Response>} The fetch response promise.
 */
async function apiFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: 'include' });
}

let checkingSession = false;

async function checkSession() {
  if (checkingSession) return;
  checkingSession = true;

  try {
    const res = await apiFetch('/api/check-manager', { method: 'GET' });
    if (res.ok) {
      showApp();
      loadAll();
      startSSE();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Error during session check:', err);
    showLogin();
  } finally {
    checkingSession = false;
  }
}

function showLogin(){
  viewLogin.classList.remove('hidden');
  appShell.classList.add('hidden');
  managerStatus.textContent = 'Not signed in';
  qs('#btnLogout').classList.add('hidden');
  // show login section only
  viewLogin.scrollIntoView({behavior:'smooth'});
}

function showApp(){
  viewLogin.classList.add('hidden');
  appShell.classList.remove('hidden');
  managerStatus.textContent = 'Signed in';
  qs('#btnLogout').classList.remove('hidden');
  showDashboard();
}

// NAV
navDashboard.addEventListener('click', () => showDashboard());
navHistory.addEventListener('click', () => showHistory());

// login/logout
btnLogin.addEventListener('click', async () => {
  const pwd = inputPassword.value.trim();
  if (!pwd) return alert('Enter password');
  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    if (!res.ok) {
      alert('Wrong password');
      if (res.status === 401) {
        alert('Incorrect password. Please try again.');
      } else if (res.status >= 500) {
        alert('Server error. Please try again later.');
      }
      return;
    }
    await checkSession();
  } catch (err) {
    console.error(err);
    if (confirm('Network error occurred while trying to log in.\n\nDetails: ' + (err && err.message ? err.message : err) + '\n\nWould you like to retry?')) {
      btnLogin.click();
    }
  }
});

btnCheckSession.addEventListener('click', checkSession);

btnLogout.addEventListener('click', async () => {
  try {
    await apiFetch('/api/logout', { method: 'POST' });
  } catch(_) {}
  // close SSE if open
  if (es) { es.close(); es = null; }
  showLogin();
});

// UI view functions
function showDashboard(){
  viewHistory.classList.add('hidden');
  viewDashboard.classList.remove('hidden');
  navDashboard.classList.add('bg-slate-200');
  navHistory.classList.remove('bg-slate-200');
}

function showHistory(){
  viewDashboard.classList.add('hidden');
  viewHistory.classList.remove('hidden');
  navHistory.classList.add('bg-slate-200');
  navDashboard.classList.remove('bg-slate-200');
  // default to today
  if(!historyDate.value) historyDate.value = new Date().toISOString().split('T')[0];
  loadHistory(historyDate.value);
}

// load all data
async function loadAll() {
  await Promise.all([loadShips(), loadCodes()]);
}

// load ships (all) and render accordingly
async function loadShips() {
  try {
    const res = await apiFetch('/api/ships');
    if(res.status === 401) { showLogin(); return; }
    const ships = await res.json();
    renderShips(ships);
  } catch (err) {
    console.error('loadShips error', err);
  }
}

function renderShips(ships) {
  // group by status
  const pending = ships.filter(s => s.status === 'pending');
  const approved = ships.filter(s => s.status === 'approved');
  const rejected = ships.filter(s => s.status === 'rejected');

  // stats
  statPending.textContent = pending.length;
  statApproved.textContent = approved.length;

  // pending cards
  pendingContainer.innerHTML = '';
  pending.forEach(s => {
    const el = document.createElement('div');
    el.className = 'fade-in p-3 rounded-lg bg-slate-900/60';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="text-white font-semibold">${escapeHtml(s.shipName)} ${s.shipCode ? '('+escapeHtml(s.shipCode)+')' : ''}</div>
          <div class="muted text-sm">${escapeHtml(s.shipType || '')} · ${escapeHtml(s.arrivalDate || '')}</div>
          <div class="mt-2 muted text-sm">${escapeHtml(s.cargoType)} ${s.cargoSubType ? '('+escapeHtml(s.cargoSubType)+')' : ''}</div>
          <div class="mt-1 muted text-xs">${escapeHtml(s.cargoDetails || s.cargoDescription || '')}</div>
        </div>
        <div class="flex flex-col gap-2">
          <button class="px-3 py-1 rounded bg-green-500 text-white text-sm" data-id="${s.id}" data-act="approve">Approve</button>
          <button class="px-3 py-1 rounded bg-red-600 text-white text-sm" data-id="${s.id}" data-act="reject">Reject</button>
        </div>
      </div>`;
    pendingContainer.appendChild(el);
  });

  // decided
  decidedContainer.innerHTML = '';
  approved.concat(rejected).forEach(s => {
    const el = document.createElement('div');
    el.className = 'p-3 rounded-lg';
    el.classList.add(s.status === 'approved' ? 'bg-emerald-800/70' : 'bg-red-900/60');
    el.innerHTML = `
      <div class="font-semibold">${escapeHtml(s.shipName)}</div>
      <div class="muted text-sm">${escapeHtml(s.cargoType)} · ${escapeHtml(String(s.cargoAmount || ''))}</div>
      <div class="text-xs muted">${escapeHtml(s.created_at || '')}</div>
    `;
    decidedContainer.appendChild(el);
  });

  // attach delegates for approve/reject
  attachPendingHandlers();
}

// attach delegated handlers for pending approve/reject
function attachPendingHandlers(){
  qsa('button[data-act]', pendingContainer).forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.act === 'approve' ? 'approved' : 'rejected';
      try {
        const res = await apiFetch('/api/ships/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action })
        });
        if(res.status === 401) { showLogin(); return; }
        // optimistic refresh
        await loadShips();
      } catch (err) { console.error(err); }
    };
  });
}

// CODES
async function loadCodes(){
  try {
    const res = await apiFetch('/api/codes');
    if(res.status === 401) { showLogin(); return; }
    const codes = await res.json();
    renderCodes(codes);
  } catch (err) { console.error('loadCodes error', err); }
}

function renderCodes(codes){
  codesContainer.innerHTML = '';
  codes.forEach(c => {
    const expires = Number(c.expires_at || c.expiresAt || 0);
    const expired = expires <= Date.now();
    const el = document.createElement('div');
    el.className = 'p-3 rounded-lg bg-slate-900/50';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="font-semibold">${escapeHtml(c.code)}</div>
          <div class="muted text-xs">${expired ? 'Expired' : 'Active'} · ${expires ? new Date(expires).toLocaleString() : ''}</div>
        </div>
        <div class="flex flex-col gap-2">
          <button class="text-sm px-2 py-1 border rounded" data-id="${c.id}" data-act="extend">Extend</button>
          <button class="text-sm px-2 py-1 border rounded" data-id="${c.id}" data-act="delete">Delete</button>
        </div>
      </div>`;
    codesContainer.appendChild(el);
  });

  // attach handlers
  qsa('button[data-act]', codesContainer).forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      try {
        const res = await apiFetch('/api/codes/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: act })
        });
        if(res.status === 401) { showLogin(); return; }
        await loadCodes();
      } catch (err) { console.error(err); }
    };
  });
}

// Generate 1-day access code (Tailwind modal version)
btnGenerateCode.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttlSeconds: 86400 }) // valid for 1 day
    });
    if (res.status === 401) { showLogin(); return; }

    const data = await res.json();
    const code = data.code.code;
    const expiresAt = new Date(Number(data.code.expires_at));

    // Format expiration date
    const formattedExpire = expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'long'
    });

    // Determine timezone
    const offset = new Date().getTimezoneOffset() / -60;
    let zone = '(Local)';
    if (offset === 7) zone = '(WIB)';
    if (offset === 8) zone = '(WITA)';
    if (offset === 9) zone = '(WIT)';

    // Update modal content
    document.getElementById('accessCodeDisplay').textContent = code;
    document.getElementById('accessExpireDisplay').textContent = `Expires: ${formattedExpire} ${zone}`;

    // Show Tailwind modal
    const modal = document.getElementById('codeModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Close modal button
    const btnClose = document.getElementById('btnCloseCodeModal');
    btnClose.onclick = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    };

    // Auto close modal after 10 seconds
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 10000);

    await loadCodes();
  } catch (err) {
    console.error('Error generating code:', err);
  }
});


btnRefreshPending.addEventListener('click', async () => {
  btnRefreshPending.textContent = 'Refreshing...';
  btnRefreshPending.disabled = true;
  try {
    await loadShips();
  } catch (err) {
    console.error(err);
  } finally {
    btnRefreshPending.textContent = 'Refresh';
    btnRefreshPending.disabled = false;
  }
});

// HISTORY
btnLoadHistory.addEventListener('click', () => {
  const date = historyDate.value;
  if(!date) return alert('Pick a date');
  loadHistory(date);
});
btnClearHistory.addEventListener('click', () => {
  historyDate.value = new Date().toISOString().split('T')[0];
  loadHistory(historyDate.value);
});

async function loadHistory(date){
  try {
    const res = await apiFetch('/api/history?date=' + encodeURIComponent(date));
    if(res.status === 401) { showLogin(); return; }
    const ships = await res.json();
    renderHistory(ships);
  } catch (err) { console.error(err); }
}

function renderHistory(ships){
  historyTbody.innerHTML = '';
  ships.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="px-3 py-2 muted text-sm">${escapeHtml(s.created_at || s.arrivalDate || '')}</td>
      <td class="px-3 py-2">${escapeHtml(s.shipName)} ${s.shipCode ? '('+escapeHtml(s.shipCode)+')' : ''}</td>
      <td class="px-3 py-2 muted">${escapeHtml(s.cargoType)} ${s.cargoSubType ? '('+escapeHtml(s.cargoSubType)+')' : ''}</td>
      <td class="px-3 py-2">${escapeHtml(String(s.cargoAmount || ''))}</td>
      <td class="px-3 py-2"><span class="px-2 py-1 rounded ${s.status==='approved' ? 'bg-emerald-600' : s.status==='rejected' ? 'bg-red-600' : 'bg-slate-500'} text-white text-xs">${escapeHtml(s.status)}</span></td>
    `;
    historyTbody.appendChild(tr);
  });
}

// SSE - connect to /events (your existing SSE)
function startSSE(){
  try {
    if (es) es.close();
    es = new EventSource('/events');

    es.addEventListener('new-ship', (e) => {
      // highlight incoming ship briefly
      const ship = JSON.parse(e.data);
      // if history filter is set and doesn't match date, ignore
      const histDate = historyDate.value;
      if(histDate){
        const created = (ship.created_at||'').split('T')[0];
        if(created !== histDate) return;
      }
      loadShips();
    });

    es.addEventListener('update-ship', (e) => {
      loadShips();
    });

    es.addEventListener('codes-updated', (e) => {
      loadCodes();
    });

    es.onopen = () => {
      reconnectTimer = 1000;
      // console.log('SSE connected');
    };

    es.onerror = (err) => {
      console.warn('SSE error', err);
      // try reconnect with backoff
      try { es.close(); } catch(_) {}
      setTimeout(() => startSSE(), reconnectTimer);
      reconnectTimer = Math.min(30000, reconnectTimer * 1.8);
    };
  } catch(err){
    console.error('startSSE error', err);
  }
}

// small HTML-escape
function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// initial
(function init() {
  // Wait for full page + cookies ready before checking session
  window.addEventListener('load', () => {
    console.log('🔍 Checking manager session after load...');
    setTimeout(checkSession, 200); // small delay to ensure cookie availability
  });
})();