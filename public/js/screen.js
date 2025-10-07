/**
 * Incoming Ship Display Screen Script
 * ------------------------------------
 * Handles:
 *  - One-time access code (OTP) login and session validation
 *  - Auto-refresh every 30 seconds with countdown
 *  - Live local time display (WIB/WITA/WIT auto-detection)
 *  - Sorted and formatted list of approved ships
 * ------------------------------------
 * Author: anugrahiyyan (@gbtr.x)
 */

document.addEventListener('DOMContentLoaded', () => {
  // === DOM Elements ===
  const codeScreen = document.getElementById('codeScreen');
  const displayScreen = document.getElementById('displayScreen');
  const codeSubmit = document.getElementById('codeSubmit');
  const codeInput = document.getElementById('codeInput');
  const approvedShips = document.getElementById('approvedShips');
  const countdownEl = document.getElementById('refreshCountdown');
  const clockEl = document.getElementById('liveClock');

  // === Session & Timer Variables ===
  let sessionToken = localStorage.getItem('sessionToken');
  let countdown = 30;

  /**
   * Attempt automatic unlock if session token exists.
   * Verifies active session from server before displaying screen.
   */
  async function tryAutoUnlock() {
    if (!sessionToken) return;
    const res = await fetch('/api/check-active-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    const data = await res.json();
    if (data.ok) unlock();
    else {
      localStorage.removeItem('sessionToken');
      sessionToken = null;
    }
  }

  /**
   * Handle OTP (one-time access code) submission
   * Verifies with server, stores session token locally
   */
  codeSubmit.addEventListener('click', async () => {
    const entered = codeInput.value.trim();
    if (!entered) return alert('Enter access code first!');
    try {
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: entered })
      });
      const data = await res.json();
      if (!data.ok) return alert('Invalid or expired access code.');

      // Save session token for persistent access
      sessionToken = data.sessionToken;
      localStorage.setItem('sessionToken', sessionToken);
      unlock();
    } catch (e) {
      console.error(e);
      alert('Server error while verifying access code.');
    }
  });

  /**
   * Unlock display screen and load initial ship data
   */
  function unlock() {
    codeScreen.classList.add('d-none');
    displayScreen.classList.remove('d-none');
    loadShips();
  }

  /**
   * Fetch and display approved ships
   * Sorted by newest first
   */
  async function loadShips() {
    const res = await fetch('/api/ships');
    const ships = await res.json();
    const approved = ships
      .filter(s => s.status === 'approved')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    approvedShips.innerHTML = '';
    if (approved.length === 0) {
      approvedShips.innerHTML = `<p class="text-center text-muted">No approved ships yet.</p>`;
      return;
    }

    approved.forEach(ship => {
      const date = new Date(ship.created_at);
      const formattedDate = formatDateToLocalString(date);
      const zone = getLocalZone();

      const div = document.createElement('div');
      div.className = 'col-md-4 fade-in';
      div.innerHTML = `
        <div class="card bg-dark text-white shadow-sm h-100 p-3">
          <div class="card-body">
            <h5 class="card-title">${ship.shipName}</h5>
            <p class="mb-1"><strong>Type:</strong> ${ship.shipType || '-'}</p>
            <p class="mb-1"><strong>Cargo:</strong> ${ship.cargoType || '-'} ${ship.cargoSubType ? '(' + ship.cargoSubType + ')' : ''}</p>
            <p class="mb-1"><strong>Amount:</strong> ${ship.cargoAmount || 0}</p>
            <p class="small text-secondary">${ship.cargoDescription || ''}</p>
            <p class="small mt-2 text-info">
              <i class="bi bi-clock-history"></i> Arrived: ${formattedDate} ${zone}
            </p>
          </div>
        </div>`;
      approvedShips.appendChild(div);
    });
  }

  /**
   * Format date into readable string with AM/PM
   * Example: "Oct 27, 2025 2:02:45 AM"
   */
  function formatDateToLocalString(date) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  }

  /**
   * Detect user timezone offset and return Indonesian local time abbreviation
   */
  function getLocalZone() {
    const offset = new Date().getTimezoneOffset() / -60;
    switch (offset) {
      case 7: return '(WIB)';
      case 8: return '(WITA)';
      case 9: return '(WIT)';
      default: return '(Local)';
    }
  }

  /**
   * Update live clock (every second)
   */
  function updateLiveClock() {
    const now = new Date();
    const zone = getLocalZone();
    const formatted = formatDateToLocalString(now);
    clockEl.textContent = `${formatted} ${zone}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  /**
   * Countdown & Auto-refresh logic (every 1 second)
   */
  setInterval(async () => {
    if (!sessionToken) return;
    countdown -= 1;
    if (countdownEl) countdownEl.textContent = countdown;

    if (countdown <= 0) {
      const res = await fetch('/api/check-active-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      });
      const data = await res.json();
      if (!data.ok) {
        alert('Access expired or revoked.');
        localStorage.removeItem('sessionToken');
        location.reload();
      } else {
        await loadShips();
      }
      countdown = 30; // Reset countdown
    }
  }, 1000);

  // === Run Auto-Check on Load ===
  tryAutoUnlock();
});
