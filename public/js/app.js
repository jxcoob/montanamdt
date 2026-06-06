// ─── ERLC Civilian Vehicles ───────────────────────────────────────────────────
const ERLC_VEHICLES = [
  "2021 Dodge Charger", "2022 Ford F-150", "2020 Chevrolet Silverado",
  "2019 Toyota Camry", "2021 Honda Civic", "2022 Tesla Model 3",
  "2020 Ford Mustang", "2021 Chevrolet Camaro", "2019 Dodge Ram 1500",
  "2022 Jeep Wrangler", "2021 GMC Sierra", "2020 Toyota Tacoma",
  "2019 Ford Explorer", "2021 Chevrolet Tahoe", "2022 Honda CR-V",
  "2020 Toyota RAV4", "2021 Ford F-250", "2019 Chevrolet Malibu",
  "2022 Nissan Altima", "2021 Hyundai Elantra", "2020 Kia Optima",
  "2019 Subaru Outback", "2022 Mazda CX-5", "2021 Toyota Highlander",
  "2020 Ford Escape", "2021 Dodge Durango", "2022 Chevrolet Equinox",
  "2019 Ford Edge", "2021 Nissan Rogue", "2020 Honda Pilot",
  "2022 Jeep Grand Cherokee", "2021 Toyota 4Runner", "2019 Ford Expedition",
  "2020 Chevrolet Suburban", "2022 GMC Yukon", "2021 RAM 2500",
  "2020 Dodge Challenger", "2019 Ford Ranger", "2022 Chevrolet Colorado",
  "2021 Toyota Tundra", "2020 Nissan Frontier", "2019 Honda Ridgeline",
  "2022 Ford Bronco", "2021 Land Rover Defender", "2020 Mercedes-Benz C300",
  "2019 BMW 3 Series", "2022 Audi A4", "2021 Volkswagen Jetta",
  "2020 Subaru Impreza", "2021 Kia Stinger",
];

// ─── App State ────────────────────────────────────────────────────────────────
let currentUser      = null;
let currentTab       = 'mdt';
let currentLogTab    = 'citation';
let mapMode          = null;
let mapInterval      = null;
let selectedVehicle  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res  = await fetch('/api/me');

  // If session expired or server restarted, redirect to login
  if (!res.ok || res.redirected) { window.location.href = '/login'; return; }

  currentUser = await res.json();

  // Guard against null/empty session
  if (!currentUser || !currentUser.username) { window.location.href = '/login'; return; }

  // Set user info in nav
  document.getElementById('nav-username').textContent = currentUser.username;
  if (currentUser.avatar) {
    document.getElementById('nav-avatar').src =
      `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`;
  }

  // Show/hide unit map tab
  if (!currentUser.hasUnitMap) {
    document.getElementById('tab-unitmap-btn').style.display = 'none';
  }

  // Check URL params for deep link
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'logs') {
    showTab('logs');
    const type = params.get('type');
    const id   = params.get('id');
    if (type) switchLogTab(type);
    if (id)   document.getElementById('log-search').value = id;
    loadLogs();
  } else {
    showTab('mdt');
  }

  loadCalls();
  loadActiveWarrants();
  setInterval(loadCalls, 15000);
  setInterval(loadActiveWarrants, 15000);
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}-btn`).classList.add('active');

  if (tab === 'logs')    loadLogs();
  if (tab === 'notes')   loadNotes();
  if (tab !== 'unitmap') stopMap();
}

// ─── MDT Forms ────────────────────────────────────────────────────────────────
let activeForm = null;

function showForm(type) {
  document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.mdt-action-btn').forEach(b => b.classList.remove('active'));

  if (activeForm === type) { activeForm = null; return; }
  activeForm = type;

  document.getElementById(`form-${type}`).style.display = 'block';
  document.querySelector(`[data-form="${type}"]`).classList.add('active');
}

function cancelForm(type) {
  document.getElementById(`form-${type}`).style.display = 'none';
  document.querySelectorAll('.mdt-action-btn').forEach(b => b.classList.remove('active'));
  activeForm = null;
  document.getElementById(`form-${type}`).querySelector('form')?.reset();
  if (type === 'citation') { selectedVehicle = null; renderVehicleSelected(); }
}

// ─── Vehicle Search ───────────────────────────────────────────────────────────
function initVehicleSearch() {
  const input    = document.getElementById('vehicle-search-input');
  const dropdown = document.getElementById('vehicle-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.classList.remove('open'); return; }

    const matches = ERLC_VEHICLES.filter(v => v.toLowerCase().includes(q)).slice(0, 12);
    if (!matches.length) { dropdown.classList.remove('open'); return; }

    matches.forEach(v => {
      const el = document.createElement('div');
      el.className = 'vehicle-option';
      el.textContent = v;
      el.onclick = () => { selectVehicle(v); dropdown.classList.remove('open'); input.value = ''; };
      dropdown.appendChild(el);
    });
    dropdown.classList.add('open');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.vehicle-search-wrap')) dropdown.classList.remove('open');
  });
}

function selectVehicle(v) {
  selectedVehicle = v;
  renderVehicleSelected();
  document.getElementById('vehicle-extra-fields').style.display = 'block';
}

function renderVehicleSelected() {
  const wrap = document.getElementById('vehicle-selected-wrap');
  if (selectedVehicle) {
    wrap.innerHTML = `<div class="vehicle-selected">${selectedVehicle} <span class="remove-vehicle" onclick="clearVehicle()">✕</span></div>`;
  } else {
    wrap.innerHTML = '';
    document.getElementById('vehicle-extra-fields').style.display = 'none';
  }
}

function clearVehicle() {
  selectedVehicle = null;
  renderVehicleSelected();
}

// ─── Submit Citation ──────────────────────────────────────────────────────────
async function submitCitation(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    username:   f.username.value.trim(),
    citedFor:   f.citedFor.value.trim(),
    fineAmount: f.fineAmount.value.trim(),
    department: f.department.value,
    vehicle:    selectedVehicle || null,
  };
  if (selectedVehicle) {
    body.licensePlate = f.licensePlate.value.trim();
    body.color        = f.color.value.trim();
  }

  const res  = await fetch('/api/log/citation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.success) { toast('Citation logged successfully!', 'success'); cancelForm('citation'); f.reset(); }
  else               toast(data.error || 'Failed to submit.', 'error');
}

// ─── Submit Arrest ────────────────────────────────────────────────────────────
async function submitArrest(e) {
  e.preventDefault();
  const f    = e.target;
  const body = { username: f.username.value.trim(), charges: f.charges.value.trim(), department: f.department.value };
  const res  = await fetch('/api/log/arrest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.success) { toast('Arrest logged successfully!', 'success'); cancelForm('arrest'); f.reset(); }
  else               toast(data.error || 'Failed to submit.', 'error');
}

// ─── Submit Incident ──────────────────────────────────────────────────────────
async function submitIncident(e) {
  e.preventDefault();
  const f    = e.target;
  const body = { leos: f.leos.value.trim(), location: f.location.value.trim(), description: f.description.value.trim(), department: f.department.value };
  const res  = await fetch('/api/log/incident', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.success) { toast('Incident logged successfully!', 'success'); cancelForm('incident'); f.reset(); }
  else               toast(data.error || 'Failed to submit.', 'error');
}

// ─── Submit Warrant ───────────────────────────────────────────────────────────
async function submitWarrant(e) {
  e.preventDefault();
  const f    = e.target;
  const body = { username: f.username.value.trim(), wantedFor: f.wantedFor.value.trim(), additionalInfo: f.additionalInfo?.value.trim() || '' };
  const res  = await fetch('/api/log/warrant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.success) { toast('Warrant issued successfully!', 'success'); cancelForm('warrant'); f.reset(); }
  else               toast(data.error || 'Failed to submit.', 'error');
}

// ─── Active Warrants (MDT page) ───────────────────────────────────────────────
async function loadActiveWarrants() {
  try {
    const res      = await fetch('/api/warrants');
    const warrants = await res.json();
    const active   = warrants.filter(w => w.status !== 'completed');
    renderActiveWarrants(active);
  } catch { renderActiveWarrants([]); }
}

function renderActiveWarrants(warrants) {
  const list = document.getElementById('active-warrants-list');
  if (!list) return;
  if (!warrants.length) {
    list.innerHTML = '<div class="no-calls">No active warrants.</div>';
    return;
  }
  list.innerHTML = warrants.slice().reverse().map(w => `
    <div class="warrant-card">
      <div class="warrant-card-title">⚠️ Warrant — ${escapeHtml(w.username)}</div>
      <div class="call-field">🔍 Wanted for: <span>${escapeHtml(w.wantedFor)}</span></div>
      ${w.additionalInfo ? `<div class="call-field">📝 Info: <span>${escapeHtml(w.additionalInfo)}</span></div>` : ''}
      <div class="call-field">👮 Issued by: <span>@${escapeHtml(w.issuedBy)}</span></div>
      <div class="warrant-card-actions">
        <button class="btn-green" onclick="completeWarrantMDT('${w.id}')">✓ Mark Completed</button>
      </div>
    </div>
  `).join('');
}

async function completeWarrantMDT(id) {
  await fetch(`/api/warrant/${id}/complete`, { method: 'PATCH' });
  loadActiveWarrants();
  loadLogs();
}

// ─── 911 Calls ────────────────────────────────────────────────────────────────
async function loadCalls() {
  try {
    const res  = await fetch('/api/erlc/calls');
    const data = await res.json();
    renderCalls(Array.isArray(data) ? data : []);
  } catch { renderCalls([]); }
}

function renderCalls(calls) {
  const list = document.getElementById('calls-list');
  if (!calls.length) { list.innerHTML = '<div class="no-calls">No active 911 calls.</div>'; return; }
  list.innerHTML = calls.map(c => `
    <div class="call-card">
      <div class="call-card-title">#${c.CallNumber || '—'} · ${c.Team || 'Unknown'} Call</div>
      <div class="call-field">📍 Location: <span>${c.PositionDescriptor || 'Unknown'}</span></div>
      <div class="call-field">📝 Description: <span>${c.Description || 'No description'}</span></div>
      <div class="call-field">🕐 Time: <span>${c.StartedAt ? new Date(c.StartedAt * 1000).toLocaleTimeString() : 'Unknown'}</span></div>
    </div>
  `).join('');
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
function switchLogTab(type) {
  currentLogTab = type;
  document.querySelectorAll('.log-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-logtab="${type}"]`).classList.add('active');
  loadLogs();
}

async function loadLogs() {
  const search = (document.getElementById('log-search')?.value || '').trim().toLowerCase();

  if (currentLogTab === 'warrant') {
    const res      = await fetch('/api/warrants');
    let warrants   = await res.json();
    if (search) warrants = warrants.filter(w =>
      w.id.toLowerCase().includes(search) ||
      w.username.toLowerCase().includes(search) ||
      w.issuedBy.toLowerCase().includes(search)
    );
    renderWarrants(warrants);
    return;
  }

  const res  = await fetch('/api/logs');
  let logs   = await res.json();
  logs = logs.filter(l => l.type === currentLogTab);
  if (search) logs = logs.filter(l =>
    l.id.toLowerCase().includes(search) ||
    (l.username && l.username.toLowerCase().includes(search)) ||
    (l.issuedBy && l.issuedBy.toLowerCase().includes(search))
  );
  renderLogs(logs);
}

function renderLogs(logs) {
  const list = document.getElementById('log-list');
  if (!logs.length) { list.innerHTML = '<div class="empty">No logs found.</div>'; return; }

  list.innerHTML = logs.slice().reverse().map(l => {
    let fields = '';
    if (l.type === 'citation') {
      fields = `
        <div class="log-card-field">Username: <span>${l.username}</span></div>
        <div class="log-card-field">Cited for: <span>${l.citedFor}</span></div>
        <div class="log-card-field">Fine amount: <span>$${l.fineAmount}</span></div>
        ${l.vehicle ? `<div class="log-card-field">Vehicle: <span>${l.vehicle}</span></div><div class="log-card-field">Plate: <span>${l.licensePlate}</span></div><div class="log-card-field">Color: <span>${l.color}</span></div>` : ''}
        <div class="log-card-field">Department: <span>${l.department}</span></div>
      `;
    } else if (l.type === 'arrest') {
      fields = `
        <div class="log-card-field">Username: <span>${l.username}</span></div>
        <div class="log-card-field">Charge(s): <span>${l.charges}</span></div>
        <div class="log-card-field">Department: <span>${l.department}</span></div>
      `;
    } else if (l.type === 'incident') {
      fields = `
        <div class="log-card-field">LEO(s): <span>${l.leos}</span></div>
        <div class="log-card-field">Location: <span>${l.location}</span></div>
        <div class="log-card-field">Description: <span>${l.description}</span></div>
        <div class="log-card-field">Department: <span>${l.department}</span></div>
      `;
    }
    return `
      <div class="log-card" id="log-${l.id}">
        <div class="log-card-body">
          <div class="log-card-id">ID: ${l.id}</div>
          <div class="log-card-title">${capitalize(l.type)} Log</div>
          ${fields}
          <div class="log-card-meta">Issued by @${l.issuedBy} · ${new Date(l.timestamp).toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderWarrants(warrants) {
  const list = document.getElementById('log-list');
  if (!warrants.length) { list.innerHTML = '<div class="empty">No warrants found.</div>'; return; }

  list.innerHTML = warrants.slice().reverse().map(w => `
    <div class="log-card ${w.status === 'completed' ? 'completed' : ''}" id="warrant-${w.id}">
      <div class="log-card-body">
        <div class="log-card-id">ID: ${w.id}</div>
        <div class="log-card-title">Warrant — ${w.username}</div>
        <div class="log-card-field">Wanted for: <span>${w.wantedFor}</span></div>
        ${w.additionalInfo ? `<div class="log-card-field">Additional info: <span>${w.additionalInfo}</span></div>` : ''}
        <div class="log-card-meta">Issued by @${w.issuedBy} · ${new Date(w.timestamp).toLocaleString()}</div>
        <div class="log-card-actions">
          ${w.status !== 'completed' ? `<button class="btn-green" onclick="completeWarrant('${w.id}')">✓ Completed</button>` : '<span style="color:var(--green);font-size:12px;font-weight:700;">✓ Completed</span>'}
          <button class="btn-red" onclick="removeWarrant('${w.id}')">Remove</button>
        </div>
      </div>
      ${w.headshot ? `<img class="log-card-thumb" src="${w.headshot}" alt="${w.username}">` : ''}
    </div>
  `).join('');
}

async function completeWarrant(id) {
  await fetch(`/api/warrant/${id}/complete`, { method: 'PATCH' });
  loadLogs();
}

async function removeWarrant(id) {
  await fetch(`/api/warrant/${id}`, { method: 'DELETE' });
  loadLogs();
}

// ─── Unit Map ─────────────────────────────────────────────────────────────────
function setMapMode(mode) {
  // Clear existing interval without nulling mapMode
  if (mapInterval) { clearInterval(mapInterval); mapInterval = null; }
  const overlay = document.getElementById('map-overlay');
  if (overlay) overlay.innerHTML = '';

  // Toggle off if same button clicked
  if (mapMode === mode) {
    mapMode = null;
    document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
    return;
  }

  mapMode = mode;
  document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-mapmode="' + mode + '"]').classList.add('active');
  fetchMapData();
  mapInterval = setInterval(fetchMapData, 5000);
}

function stopMap() {
  if (mapInterval) { clearInterval(mapInterval); mapInterval = null; }
  mapMode = null;
  document.querySelectorAll('.map-ctrl-btn').forEach(b => b.classList.remove('active'));
  const overlay = document.getElementById('map-overlay');
  if (overlay) overlay.innerHTML = '';
}

async function fetchMapData() {
  try {
    const res  = await fetch('/api/erlc/players');
    const data = await res.json();
    renderMapDots(Array.isArray(data) ? data : []);
  } catch {}
}

function renderMapDots(players) {
  const overlay = document.getElementById('map-overlay');
  const mapImg  = document.getElementById('map-img');
  if (!overlay || !mapImg) return;

  overlay.innerHTML = '';

  if (!Array.isArray(players) || !players.length) return;

  // ERLC API: Team is exactly "Sheriff", "Police", "Civilian", "Fire", etc.
  // Player field is "Username:RobloxId"
  // Location fields: p.Location.LocationX and p.Location.LocationZ
  const filtered = players.filter(p => {
    if (mapMode === 'sheriff') return p.Team === 'Sheriff';
    if (mapMode === 'police')  return p.Team === 'Police';
    return false;
  });

  filtered.forEach(p => {
    const loc = p.Location;
    if (!loc) return;

    const x = loc.LocationX;
    const z = loc.LocationZ;

    // ERLC Liberty County map coordinate bounds
    // Approximate: X range -3000 to 3000, Z range -3000 to 3000
    const xNorm = (x + 3000) / 6000;
    const zNorm = (z + 3000) / 6000;

    const dot = document.createElement('div');
    dot.className = 'map-unit-dot ' + mapMode;
    dot.style.left = Math.min(Math.max(xNorm * 100, 0), 100) + '%';
    dot.style.top  = Math.min(Math.max(zNorm * 100, 0), 100) + '%';

    // Player field is "Username:RobloxId" — show just the username
    const playerName = (p.Player || '').split(':')[0] || 'Unknown';
    const callsign   = p.Callsign ? ' [' + p.Callsign + ']' : '';
    const postal     = loc.PostalCode ? ' · ' + loc.PostalCode : '';

    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.textContent = playerName + callsign + postal;
    dot.appendChild(tooltip);

    dot.addEventListener('mouseenter', () => tooltip.style.display = 'block');
    dot.addEventListener('mouseleave', () => tooltip.style.display = 'none');
    tooltip.style.display = 'none';

    overlay.appendChild(dot);
  });
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function toggleNoteForm() {
  const wrap = document.getElementById('note-form-wrap');
  wrap.classList.toggle('open');
}

async function submitNote(e) {
  e.preventDefault();
  const f    = e.target;
  const body = { note: f.noteText.value.trim() };
  const res  = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.success) {
    toast('Note saved!', 'success');
    f.reset();
    document.getElementById('note-form-wrap').classList.remove('open');
    loadNotes();
  }
}

async function loadNotes() {
  const res   = await fetch('/api/notes');
  const notes = await res.json();
  renderNotes(notes);
}

function renderNotes(notes) {
  const list = document.getElementById('notes-list');
  if (!notes.length) { list.innerHTML = '<div class="empty">No notes yet.</div>'; return; }
  list.innerHTML = notes.slice().reverse().map(n => `
    <div class="note-card" id="note-${n.id}">
      <div class="note-card-text">${escapeHtml(n.note)}</div>
      <div class="note-card-meta">${new Date(n.timestamp).toLocaleString()}</div>
      <button class="btn-red" onclick="archiveNote('${n.id}')">Archive</button>
    </div>
  `).join('');
}

async function archiveNote(id) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  loadNotes();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toast(msg, type = 'success') {
  const c   = document.getElementById('toast-container');
  const el  = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init();
  initVehicleSearch();

  // Populate department dropdowns with only allowed departments
  // (done after user loads in init via populateDeptDropdowns)
});

async function populateDeptDropdowns() {
  const depts = currentUser.departments.map(d => d.name);
  ['dept-citation', 'dept-arrest', 'dept-incident'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select department...</option>' +
      depts.map(d => `<option value="${d}">${d}</option>`).join('');
  });
}
