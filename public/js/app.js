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
let selectedVehicle  = null;
let searchMode       = 'person'; // 'person' | 'plate'
let plateOwnerData   = null;    // cached for modal

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch('/api/me');
  if (!res.ok || res.redirected) { window.location.href = '/login'; return; }

  currentUser = await res.json();
  if (!currentUser || !currentUser.username) { window.location.href = '/login'; return; }

  document.getElementById('nav-username').textContent = currentUser.username;
  if (currentUser.avatar) {
    const img = document.getElementById('nav-avatar');
    img.src   = `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`;
    img.style.display = 'block';
  }

  // Show supervisor badge & export button if supervisor
  if (currentUser.isSupervisor) {
    document.getElementById('supervisor-badge').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'inline-flex';
  }

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
  if (!warrants.length) { list.innerHTML = '<div class="no-calls">No active warrants.</div>'; return; }
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
        <div class="log-card-field">Username: <span>${escapeHtml(l.username)}</span></div>
        <div class="log-card-field">Cited for: <span>${escapeHtml(l.citedFor)}</span></div>
        <div class="log-card-field">Fine amount: <span>$${escapeHtml(String(l.fineAmount))}</span></div>
        ${l.vehicle ? `<div class="log-card-field">Vehicle: <span>${escapeHtml(l.vehicle)}</span></div><div class="log-card-field">Plate: <span>${escapeHtml(l.licensePlate)}</span></div><div class="log-card-field">Color: <span>${escapeHtml(l.color)}</span></div>` : ''}
        <div class="log-card-field">Department: <span>${escapeHtml(l.department)}</span></div>
      `;
    } else if (l.type === 'arrest') {
      fields = `
        <div class="log-card-field">Username: <span>${escapeHtml(l.username)}</span></div>
        <div class="log-card-field">Charge(s): <span>${escapeHtml(l.charges)}</span></div>
        <div class="log-card-field">Department: <span>${escapeHtml(l.department)}</span></div>
      `;
    } else if (l.type === 'incident') {
      fields = `
        <div class="log-card-field">LEO(s): <span>${escapeHtml(l.leos)}</span></div>
        <div class="log-card-field">Location: <span>${escapeHtml(l.location)}</span></div>
        <div class="log-card-field">Description: <span>${escapeHtml(l.description)}</span></div>
        <div class="log-card-field">Department: <span>${escapeHtml(l.department)}</span></div>
      `;
    }

    const voidedBadge = l.voided ? `<span class="voided-badge">VOIDED</span>` : '';
    const voidBtn = currentUser.isSupervisor && !l.voided
      ? `<button class="btn-red" onclick="voidLog('${l.id}')">Void Log</button>`
      : '';

    return `
      <div class="log-card ${l.voided ? 'voided' : ''}" id="log-${l.id}">
        <div class="log-card-body">
          <div class="log-card-id">ID: ${l.id}</div>
          <div class="log-card-title">${capitalize(l.type)} Log ${voidedBadge}</div>
          ${fields}
          <div class="log-card-meta">Issued by @${escapeHtml(l.issuedBy)} · ${new Date(l.timestamp).toLocaleString()}</div>
          ${l.voided ? `<div class="log-card-meta" style="color:var(--red)">Voided by @${escapeHtml(l.voidedBy)} · ${new Date(l.voidedAt).toLocaleString()}</div>` : ''}
          <div class="log-card-actions">${voidBtn}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function voidLog(id) {
  if (!confirm('Mark this log as voided? This cannot be undone.')) return;
  const res  = await fetch(`/api/log/${id}/void`, { method: 'PATCH' });
  const data = await res.json();
  if (data.success) { toast('Log voided.', 'success'); loadLogs(); }
  else               toast(data.error || 'Failed.', 'error');
}

async function renderWarrants(warrants) {
  const list = document.getElementById('log-list');
  if (!warrants.length) { list.innerHTML = '<div class="empty">No warrants found.</div>'; return; }

  list.innerHTML = warrants.slice().reverse().map(w => `
    <div class="log-card ${w.status === 'completed' ? 'completed' : ''}" id="warrant-${w.id}">
      <div class="log-card-body">
        <div class="log-card-id">ID: ${w.id}</div>
        <div class="log-card-title">Warrant — ${escapeHtml(w.username)}</div>
        <div class="log-card-field">Wanted for: <span>${escapeHtml(w.wantedFor)}</span></div>
        ${w.additionalInfo ? `<div class="log-card-field">Additional info: <span>${escapeHtml(w.additionalInfo)}</span></div>` : ''}
        <div class="log-card-meta">Issued by @${escapeHtml(w.issuedBy)} · ${new Date(w.timestamp).toLocaleString()}</div>
        <div class="log-card-actions">
          ${w.status !== 'completed' ? `<button class="btn-green" onclick="completeWarrant('${w.id}')">✓ Completed</button>` : '<span style="color:var(--green);font-size:12px;font-weight:700;">✓ Completed</span>'}
          ${currentUser.isSupervisor ? `<button class="btn-red" onclick="removeWarrant('${w.id}')">Remove</button>` : ''}
        </div>
      </div>
      ${w.headshot ? `<img class="log-card-thumb" src="${w.headshot}" alt="${escapeHtml(w.username)}">` : ''}
    </div>
  `).join('');
}

async function completeWarrant(id) {
  await fetch(`/api/warrant/${id}/complete`, { method: 'PATCH' });
  loadLogs();
}

async function removeWarrant(id) {
  if (!confirm('Permanently remove this warrant?')) return;
  const res  = await fetch(`/api/warrant/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) { toast('Warrant removed.', 'success'); loadLogs(); }
  else               toast(data.error || 'Failed.', 'error');
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportLogs() {
  const url = `/api/export/logs?type=${currentLogTab !== 'warrant' ? currentLogTab : ''}`;
  window.open(url, '_blank');
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

// ─── SEARCH TAB ───────────────────────────────────────────────────────────────

function setSearchMode(mode) {
  searchMode = mode;
  document.getElementById('smode-person').classList.toggle('active', mode === 'person');
  document.getElementById('smode-plate').classList.toggle('active', mode === 'plate');
  document.getElementById('search-main-input').placeholder =
    mode === 'person' ? 'Enter Roblox username...' : 'Enter license plate (e.g. ABC-1234)...';
  document.getElementById('search-main-input').value = '';
  hideSearchResults();
  closeAutocomplete();
}

function hideSearchResults() {
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-person-results').style.display = 'none';
  document.getElementById('search-plate-results').style.display = 'none';
  document.getElementById('search-loading').style.display = 'none';
  document.getElementById('search-empty').style.display = 'none';
}

// Autocomplete: suggest from citation logs for username / plate
let allLogs = [];
async function ensureLogs() {
  if (!allLogs.length) {
    const res = await fetch('/api/logs');
    allLogs   = await res.json();
  }
}

async function onSearchInput() {
  const q = document.getElementById('search-main-input').value.trim().toLowerCase();
  const ac = document.getElementById('search-autocomplete');

  if (!q || q.length < 2) { ac.classList.remove('open'); ac.innerHTML = ''; return; }

  await ensureLogs();

  let suggestions = [];
  if (searchMode === 'person') {
    const usernames = [...new Set(allLogs.map(l => l.username).filter(Boolean))];
    suggestions = usernames.filter(u => u.toLowerCase().includes(q)).slice(0, 8);
  } else {
    const plates = [...new Set(allLogs.map(l => l.licensePlate).filter(Boolean))];
    suggestions = plates.filter(p => p.toLowerCase().includes(q)).slice(0, 8);
  }

  if (!suggestions.length) { ac.classList.remove('open'); ac.innerHTML = ''; return; }

  ac.innerHTML = suggestions.map(s => `
    <div class="search-ac-item" onclick="selectSuggestion('${escapeHtml(s)}')">${escapeHtml(s)}</div>
  `).join('');
  ac.classList.add('open');
}

function selectSuggestion(val) {
  document.getElementById('search-main-input').value = val;
  closeAutocomplete();
  doSearch();
}

function closeAutocomplete() {
  const ac = document.getElementById('search-autocomplete');
  ac.classList.remove('open'); ac.innerHTML = '';
}

function onSearchKeydown(e) {
  if (e.key === 'Enter') doSearch();
  if (e.key === 'Escape') closeAutocomplete();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-input-wrap')) closeAutocomplete();
});

async function doSearch() {
  const q = document.getElementById('search-main-input').value.trim();
  if (!q) return;
  closeAutocomplete();
  hideSearchResults();
  document.getElementById('search-loading').style.display = 'flex';

  try {
    if (searchMode === 'person') {
      await searchPerson(q);
    } else {
      await searchPlate(q);
    }
  } catch (err) {
    document.getElementById('search-loading').style.display = 'none';
    document.getElementById('search-empty').style.display = 'block';
    document.getElementById('search-empty').textContent = 'Error: ' + err.message;
  }
}

// ─── Person search ─────────────────────────────────────────────────────────────
async function searchPerson(username) {
  const res  = await fetch(`/api/roblox/profile/${encodeURIComponent(username)}`);
  document.getElementById('search-loading').style.display = 'none';

  if (!res.ok) {
    document.getElementById('search-empty').style.display = 'block';
    document.getElementById('search-empty').textContent = 'No records found for that username.';
    return;
  }

  const data = await res.json();
  renderPersonResult(data, 'sp', 'mugshot-avatar', 'mugshot-ruler', 'mugshot-label');

  document.getElementById('search-results').style.display = 'block';
  document.getElementById('search-person-results').style.display = 'block';
}

// ─── Render person result (shared by search and modal) ────────────────────────
function renderPersonResult(data, prefix, avatarId, rulerId, labelId) {
  document.getElementById(`${prefix}-username`).textContent = data.username;
  document.getElementById(`${prefix}-robloxid`).textContent = data.robloxId ? `Roblox ID: ${data.robloxId}` : '';

  // Appearance from server-side AI analysis
  const ap = data.appearance || {};
  document.getElementById(`${prefix}-skin`).textContent   = ap.skinColor || 'Unknown';
  document.getElementById(`${prefix}-hair`).textContent   = ap.hairColor || 'Unknown';
  document.getElementById(`${prefix}-gender`).textContent = ap.gender    || 'Unknown';

  // Height: hash-based stable value per username, using AI gender to determine range
  const gender    = (ap.gender || '').toLowerCase();
  const inchTotal = estimateHeight(data.username, gender);
  const ft        = Math.floor(inchTotal / 12);
  const inch      = inchTotal % 12;
  const heightStr = `${ft}'${inch}"`;
  document.getElementById(`${prefix}-height`).textContent = heightStr;

  // Citations
  const citations = data.citations || [];
  document.getElementById(`${prefix}-citation-count`).textContent = citations.length;
  document.getElementById(`${prefix}-citations-list`).innerHTML = citations.length
    ? citations.slice(-3).reverse().map(c => `
        <div class="record-mini-item">
          <strong>${escapeHtml(c.citedFor)}</strong> — $${c.fineAmount}
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(c.timestamp).toLocaleDateString()}</div>
        </div>`).join('')
    : '<div class="record-mini-none">No citations on record.</div>';

  // Arrests
  const arrests = data.arrests || [];
  document.getElementById(`${prefix}-arrest-count`).textContent = arrests.length;
  document.getElementById(`${prefix}-arrests-list`).innerHTML = arrests.length
    ? arrests.slice(-3).reverse().map(a => `
        <div class="record-mini-item">
          <strong>${escapeHtml(a.charges)}</strong>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(a.timestamp).toLocaleDateString()}</div>
        </div>`).join('')
    : '<div class="record-mini-none">No arrests on record.</div>';

  // Warrants
  const warrants = data.activeWarrants || [];
  document.getElementById(`${prefix}-warrant-count`).textContent = warrants.length;
  document.getElementById(`${prefix}-warrants-list`).innerHTML = warrants.length
    ? warrants.map(w => `
        <div class="record-mini-item" style="border-left:3px solid var(--accent)">
          <strong>${escapeHtml(w.wantedFor)}</strong>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(w.timestamp).toLocaleDateString()}</div>
        </div>`).join('')
    : '<div class="record-mini-none">No active warrants.</div>';

  // Mugshot avatar
  const avatarImg = document.getElementById(avatarId);
  if (data.fullAvatar) {
    avatarImg.onload = () => positionAvatarForHeight(avatarImg, inchTotal, rulerId);
    avatarImg.src    = data.fullAvatar;
    avatarImg.style.display = 'block';
  } else {
    avatarImg.style.display = 'none';
  }

  // Build ruler
  buildRuler(rulerId, inchTotal);

  // Label
  const labelEl = document.getElementById(labelId);
  if (labelEl) labelEl.textContent = `MONTANA MDT · ${data.username.toUpperCase()}`;
}

// Hash-based stable height using AI gender for range
function estimateHeight(username, gender) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  if (gender === 'female') {
    return Math.min(69, Math.max(58, 58 + (hash % 12))); // 4'10" – 5'9"
  } else {
    return Math.min(75, Math.max(65, 65 + (hash % 11))); // 5'5" – 6'3"
  }
}

// ─── Ruler: 4'10" to 7'0" with even marks ─────────────────────────────────────
// RULER_TOP_INCH and RULER_BOTTOM_INCH define the range displayed
const RULER_TOP_INCH    = 84; // 7'0"
const RULER_BOTTOM_INCH = 58; // 4'10"
const RULER_RANGE_INCH  = RULER_TOP_INCH - RULER_BOTTOM_INCH; // 26 inches

function buildRuler(rulerId, subjectInchTotal) {
  const ruler = document.getElementById(rulerId);
  if (!ruler) return;

  // Marks every 2 inches, labels every foot
  const marks = [];
  for (let total = RULER_TOP_INCH; total >= RULER_BOTTOM_INCH; total -= 2) {
    const ft   = Math.floor(total / 12);
    const inch = total % 12;
    const isFoot = inch === 0;
    marks.push({ label: isFoot ? `${ft}'0"` : (inch % 12 === 0 ? '' : `${ft}'${inch}"`), isFoot, total });
  }

  ruler.innerHTML = marks.map(m => `
    <div class="ruler-mark" style="flex:1;display:flex;align-items:center;position:relative;">
      <span class="ruler-mark-text" style="font-size:${m.isFoot ? '9' : '7'}px;font-weight:${m.isFoot ? '900' : '600'};color:${m.isFoot ? '#111' : '#555'};padding-right:${m.isFoot ? '16' : '14'}px;min-width:38px;text-align:right;font-family:'Arial Narrow',Arial,sans-serif;">${m.label}</span>
      <div style="position:absolute;right:0;height:${m.isFoot ? '2' : '1'}px;width:${m.isFoot ? '14' : '8'}px;background:${m.isFoot ? '#222' : '#888'};"></div>
    </div>
  `).join('');
}

// Position avatar so the top of the head aligns with the correct height mark
function positionAvatarForHeight(img, inchTotal, rulerId) {
  const ruler = document.getElementById(rulerId);
  if (!ruler) return;

  const rulerH = ruler.offsetHeight;
  if (!rulerH) return;

  // Calculate where this height falls on the ruler (0 = top=7'0", 1 = bottom=4'10")
  const fraction = (RULER_TOP_INCH - inchTotal) / RULER_RANGE_INCH;
  // Pixel Y from top of ruler where this height mark sits
  const targetY = fraction * rulerH;

  // The avatar image: we know its natural dimensions once loaded.
  // We want the top of the head to be at targetY.
  // The Roblox avatar image has some padding at top (~5% of height) before the head.
  // Approximate head-top offset within the image: ~8% from top.
  const imgNaturalH = img.naturalHeight || img.height || 720;
  const headOffsetFraction = 0.05; // ~5% from top of image to top of head

  // The mugshot subject div fills the frame below the ruler in a flex layout.
  // We need to set margin-top on the img so that headOffsetFraction * imgDisplayH = targetY
  // img display height is constrained by the container; let's use the container's height.
  const subject  = img.closest('.mugshot-subject');
  if (!subject) return;
  const subjectH = subject.offsetHeight;

  // Scale factor: img fills width of container (320px or 260px)
  const containerW = subject.offsetWidth - 52; // minus ruler width
  const imgW       = img.naturalWidth  || 720;
  const imgH       = img.naturalHeight || 720;
  const scale      = containerW / imgW;
  const displayH   = imgH * scale;

  const headPixelInDisplay = displayH * headOffsetFraction;

  // We want: marginTop + headPixelInDisplay = targetY
  // But targetY is relative to the ruler, which sits above mugshot-subject in the frame.
  // The ruler and subject share the mugshot-frame height.
  // Simpler: position the img so its top is pushed down until the head is at the right mark.
  // Use bottom-anchored approach: img sits at bottom, we lift it.
  // Distance from bottom of subject to bottom of ruler range = subjectH - (rulerH - targetY)... complex.
  // Easier: set img height to fill the frame proportionally.
  // The frame total height = ruler area. Set img to display at correct scale so head aligns.

  // Use a simple approach: set the img max-height to force the body bottom to sit at the bottom of the frame,
  // and use object-position to push the image so the head is at the right ruler position.
  // Actually the cleanest: use margin-top to shift img up so head aligns.

  // The mugshot-subject is flex align-items:flex-end, so img sits at bottom.
  // We don't touch that. Instead use transform: translateY to shift up.
  // The ruler occupies rulerH pixels. The subject is below it (or alongside).
  // They're siblings in .mugshot-frame which is flex-column.
  // subjectH is the height of mugshot-subject.
  // The frame height = rulerH + subjectH + labelH (~36px).
  // The ruler starts at y=0 in the frame.
  // mugshot-subject starts at y = rulerH.
  // We want the img head (at headOffsetFraction from img top) to be at y = targetY in the frame.
  // img bottom is at y = rulerH + subjectH (frame bottom - label).
  // img top = img bottom - displayH = rulerH + subjectH - displayH.
  // head y = img top + headPixelInDisplay = rulerH + subjectH - displayH + headPixelInDisplay.
  // We want this = targetY.
  // => rulerH + subjectH - displayH + headPixelInDisplay = targetY
  // => headPixelInDisplay - displayH = targetY - rulerH - subjectH
  // This means we may need to resize the image.
  // Simplest real fix: set the img height directly so the scale makes the head at the right spot.
  // displayH_needed: rulerH + subjectH - targetY + headPixelInDisplay_new
  // headPixelInDisplay_new = displayH_needed * headOffsetFraction
  // displayH_needed - displayH_needed * headOffsetFraction = rulerH + subjectH - targetY
  // displayH_needed * (1 - headOffsetFraction) = rulerH + subjectH - targetY
  // displayH_needed = (rulerH + subjectH - targetY) / (1 - headOffsetFraction)

  const frameBottom  = rulerH + subjectH;
  const displayHNeeded = (frameBottom - targetY) / (1 - headOffsetFraction);

  img.style.height    = `${Math.round(displayHNeeded)}px`;
  img.style.width     = 'auto';
  img.style.maxWidth  = '100%';
  img.style.maxHeight = 'none';
  img.style.display   = 'block';
}

// ─── Plate search ──────────────────────────────────────────────────────────────
async function searchPlate(plate) {
  const res  = await fetch(`/api/search/plate/${encodeURIComponent(plate.toUpperCase())}`);
  document.getElementById('search-loading').style.display = 'none';

  if (!res.ok) {
    document.getElementById('search-empty').style.display = 'block';
    return;
  }

  const data = await res.json();
  if (!data.found) {
    document.getElementById('search-empty').style.display = 'block';
    document.getElementById('search-empty').textContent = 'No vehicle found with that plate in citation records.';
    return;
  }

  plateOwnerData = data.owner;

  document.getElementById('pl-vehicle').textContent = data.vehicle || 'Unknown Vehicle';
  document.getElementById('pl-plate').textContent   = data.plate || plate.toUpperCase();
  document.getElementById('pl-color').textContent   = data.color || '—';

  document.getElementById('search-results').style.display = 'block';
  document.getElementById('search-plate-results').style.display = 'block';
}

// ─── Owner Modal ───────────────────────────────────────────────────────────────
function openOwnerModal() {
  if (!plateOwnerData) return;
  const owner = plateOwnerData;

  // Populate modal fields
  document.getElementById('modal-username').textContent = owner.username;
  document.getElementById('modal-robloxid').textContent = owner.robloxId ? `Roblox ID: ${owner.robloxId}` : '';

  const { gender, height } = estimateHeightGender(owner.username);
  document.getElementById('modal-height').textContent  = height;
  document.getElementById('modal-gender').textContent  = capitalize(gender);
  document.getElementById('modal-skin').textContent    = 'Analyzing...';
  document.getElementById('modal-hair').textContent    = 'Analyzing...';

  // Citations
  const citations = owner.citations || [];
  document.getElementById('modal-citation-count').textContent = citations.length;
  document.getElementById('modal-citations-list').innerHTML = citations.length
    ? citations.slice(-3).reverse().map(c => `<div class="record-mini-item"><strong>${escapeHtml(c.citedFor)}</strong> — $${c.fineAmount}<div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(c.timestamp).toLocaleDateString()}</div></div>`).join('')
    : '<div class="record-mini-none">No citations on record.</div>';

  const arrests = owner.arrests || [];
  document.getElementById('modal-arrest-count').textContent = arrests.length;
  document.getElementById('modal-arrests-list').innerHTML = arrests.length
    ? arrests.slice(-3).reverse().map(a => `<div class="record-mini-item"><strong>${escapeHtml(a.charges)}</strong><div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(a.timestamp).toLocaleDateString()}</div></div>`).join('')
    : '<div class="record-mini-none">No arrests on record.</div>';

  const warrants = owner.activeWarrants || [];
  document.getElementById('modal-warrant-count').textContent = warrants.length;
  document.getElementById('modal-warrants-list').innerHTML = warrants.length
    ? warrants.map(w => `<div class="record-mini-item" style="border-left:3px solid var(--accent)"><strong>${escapeHtml(w.wantedFor)}</strong><div style="font-size:11px;color:var(--text-dim);margin-top:2px">${new Date(w.timestamp).toLocaleDateString()}</div></div>`).join('')
    : '<div class="record-mini-none">No active warrants.</div>';

  // Mugshot
  const avatarImg = document.getElementById('modal-mugshot-avatar');
  if (owner.fullAvatar) {
    avatarImg.src   = owner.fullAvatar;
    avatarImg.style.display = 'block';
    analyzeAvatarAppearance(owner.fullAvatar, owner.username, 'modal');
  } else {
    avatarImg.style.display = 'none';
  }

  buildRuler('modal-mugshot-ruler', height, gender);

  document.getElementById('owner-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeOwnerModal(e) {
  if (e && e.target !== document.getElementById('owner-modal')) return;
  document.getElementById('owner-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

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
