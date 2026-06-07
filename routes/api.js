const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const router  = express.Router();
const { readData, writeData } = require('../db');

const BOT_TOKEN  = process.env.TOKEN;
const ERLC_KEY   = process.env.ERLC_API_KEY;

// Supervisor role in main server
const SUPERVISOR_GUILD_ID = '1451707915286085706'; // main server
const SUPERVISOR_ROLE_ID  = '1469135279049933007';

const DEPT_CONFIG = {
    'Missoula City Police Department': {
        guildId:    '1490470605194137662',
        roleId:     '1499985143853486130',
        channels:   { citation: '1512835129163251822', arrest: '1512835146171289610', incident: '1512835172402335886' },
    },
    'Missoula County Sheriff\'s Office': {
        guildId:    '1498131736305860708',
        roleId:     '1498131737450905795',
        channels:   { citation: '1498131740202369127', arrest: '1498131740202369128', incident: '1498131740202369130' },
    },
    'Montana Highway Patrol': {
        guildId:    '1490141856607113278',
        roleId:     '1490377039746830372',
        channels:   { citation: '1512835550556454932', arrest: '1512835573629321246', incident: '1512835594294661170' },
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

async function sendDiscordMessage(channelId, payload) {
    const res = await fetch(`https://discord.com/api/channels/${channelId}/messages`, {
        method:  'POST',
        headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    });
    return res.json();
}

async function getRobloxUser(username) {
    try {
        const res  = await fetch('https://users.roblox.com/v1/usernames/users', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            const u = data.data[0];
            return { id: u.id, url: `https://www.roblox.com/users/${u.id}/profile` };
        }
    } catch {}
    return null;
}

async function getRobloxHeadshot(userId) {
    try {
        const res  = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);
        const data = await res.json();
        return data.data?.[0]?.imageUrl || null;
    } catch { return null; }
}

async function getRobloxFullAvatar(userId) {
    try {
        const res  = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=352x352&format=Png`);
        const data = await res.json();
        return data.data?.[0]?.imageUrl || null;
    } catch { return null; }
}

// Check if user is supervisor
async function isSupervisor(userId) {
    try {
        const res = await fetch(
            `https://discord.com/api/guilds/${SUPERVISOR_GUILD_ID}/members/${userId}`,
            { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
        );
        if (!res.ok) return false;
        const member = await res.json();
        return member.roles && member.roles.includes(SUPERVISOR_ROLE_ID);
    } catch { return false; }
}

// ─── Session / User info ──────────────────────────────────────────────────────

router.get('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.session.user);
});

// ─── Supervisor check ─────────────────────────────────────────────────────────

router.get('/me/supervisor', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const sup = await isSupervisor(req.session.user.id);
    res.json({ isSupervisor: sup });
});

// ─── ERLC ─────────────────────────────────────────────────────────────────────

router.get('/erlc/players', async (req, res) => {
    try {
        const r = await fetch('https://api.erlc.gg/v2/server?Players=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(data.Players || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/erlc/calls', async (req, res) => {
    try {
        const r    = await fetch('https://api.erlc.gg/v2/server?EmergencyCalls=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(Array.isArray(data.EmergencyCalls) ? data.EmergencyCalls : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/erlc/killlogs', async (req, res) => {
    try {
        const r    = await fetch('https://api.erlc.gg/v2/server?KillLogs=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(Array.isArray(data.KillLogs) ? data.KillLogs : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/erlc/joinlogs', async (req, res) => {
    try {
        const r    = await fetch('https://api.erlc.gg/v2/server?JoinLogs=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(Array.isArray(data.JoinLogs) ? data.JoinLogs : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/erlc/server', async (req, res) => {
    try {
        const r    = await fetch('https://api.erlc.gg/v2/server', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/erlc/vehicles', async (req, res) => {
    try {
        const r    = await fetch('https://api.erlc.gg/v2/server?Vehicles=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        res.json(Array.isArray(data.Vehicles) ? data.Vehicles : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get('/logs', async (req, res) => {
    res.json(await readData('logs.json'));
});

router.get('/warrants', async (req, res) => {
    res.json(await readData('warrants.json'));
});

// ─── Submit Citation ──────────────────────────────────────────────────────────

router.post('/log/citation', async (req, res) => {
    const { username, citedFor, fineAmount, department, vehicle, licensePlate, color } = req.body;
    const user = req.session.user;

    const dept = DEPT_CONFIG[department];
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    const hasDept = user.departments.some(d => d.guildId === dept.guildId);
    if (!hasDept) return res.status(403).json({ error: 'You do not have access to log for that department.' });

    const roblox  = await getRobloxUser(username);
    const robloxLink = roblox ? `[${username}](${roblox.url})` : username;
    const id      = generateId();
    const BASE_URL = process.env.BASE_URL || 'https://montanamdt.onrender.com';
    const logUrl  = `${BASE_URL}/?tab=logs&type=citation&id=${id}`;

    let content = `## Citation Log - <@${user.id}>\n**Username:** ${robloxLink}\n**Cited for:** ${citedFor}\n**Fine amount:** $${fineAmount}`;
    if (vehicle) {
        content += `\n\n**Vehicle:** ${vehicle}\n**License Plate:** ${licensePlate}\n**Color:** ${color}`;
    }

    const payload = {
        flags: 32768,
        components: [
            {
                type: 17,
                components: [
                    { type: 10, content },
                    { type: 14 },
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 5, label: 'View the log here', url: logUrl },
                            { type: 2, style: 2, emoji: { id: '1512828931441561770', name: 'unknown', animated: false }, disabled: true, custom_id: `log_dept_${id}` },
                        ],
                    },
                ],
                accent_color: null,
            },
        ],
    };

    await sendDiscordMessage(dept.channels.citation, payload);

    const logs = await readData('logs.json');
    logs.push({ id, type: 'citation', department, username, citedFor, fineAmount, vehicle: vehicle || null, licensePlate: licensePlate || null, color: color || null, issuedBy: user.username, issuedById: user.id, timestamp: Date.now(), voided: false });
    await writeData('logs.json', logs);

    res.json({ success: true, id });
});

// ─── Submit Arrest ────────────────────────────────────────────────────────────

router.post('/log/arrest', async (req, res) => {
    const { username, charges, department } = req.body;
    const user = req.session.user;

    const dept = DEPT_CONFIG[department];
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    const hasDept = user.departments.some(d => d.guildId === dept.guildId);
    if (!hasDept) return res.status(403).json({ error: 'You do not have access to log for that department.' });

    const roblox     = await getRobloxUser(username);
    const robloxLink = roblox ? `[${username}](${roblox.url})` : username;
    const id         = generateId();
    const BASE_URL   = process.env.BASE_URL || 'https://montanamdt.onrender.com';
    const logUrl     = `${BASE_URL}/?tab=logs&type=arrest&id=${id}`;

    const content = `## Arrest Log - <@${user.id}>\n**Username:** ${robloxLink}\n**Charge(s):** ${charges}`;

    const payload = {
        flags: 32768,
        components: [
            {
                type: 17,
                components: [
                    { type: 10, content },
                    { type: 14 },
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 5, label: 'View the log here', url: logUrl },
                            { type: 2, style: 2, emoji: { id: '1512828931441561770', name: 'unknown', animated: false }, disabled: true, custom_id: `log_dept_${id}` },
                        ],
                    },
                ],
                accent_color: null,
            },
        ],
    };

    await sendDiscordMessage(dept.channels.arrest, payload);

    const logs = await readData('logs.json');
    logs.push({ id, type: 'arrest', department, username, charges, issuedBy: user.username, issuedById: user.id, timestamp: Date.now(), voided: false });
    await writeData('logs.json', logs);

    res.json({ success: true, id });
});

// ─── Submit Incident ──────────────────────────────────────────────────────────

router.post('/log/incident', async (req, res) => {
    const { leos, location, description, department } = req.body;
    const user = req.session.user;

    const dept = DEPT_CONFIG[department];
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    const hasDept = user.departments.some(d => d.guildId === dept.guildId);
    if (!hasDept) return res.status(403).json({ error: 'You do not have access to log for that department.' });

    const id       = generateId();
    const BASE_URL = process.env.BASE_URL || 'https://montanamdt.onrender.com';
    const logUrl   = `${BASE_URL}/?tab=logs&type=incident&id=${id}`;

    const content = `## Incident Log - <@${user.id}>\n**LEO(s) involved:** ${leos}\n**Location:** ${location}\n**Description:** \`\`\`${description}\`\`\``;

    const payload = {
        flags: 32768,
        components: [
            {
                type: 17,
                components: [
                    { type: 10, content },
                    { type: 14 },
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 5, label: 'View the log here', url: logUrl },
                            { type: 2, style: 2, emoji: { id: '1512828931441561770', name: 'unknown', animated: false }, disabled: true, custom_id: `log_dept_${id}` },
                        ],
                    },
                ],
                accent_color: null,
            },
        ],
    };

    await sendDiscordMessage(dept.channels.incident, payload);

    const logs = await readData('logs.json');
    logs.push({ id, type: 'incident', department, leos, location, description, issuedBy: user.username, issuedById: user.id, timestamp: Date.now(), voided: false });
    await writeData('logs.json', logs);

    res.json({ success: true, id });
});

// ─── Void a log (supervisor only) ─────────────────────────────────────────────

router.patch('/log/:id/void', async (req, res) => {
    const user = req.session.user;
    const sup  = await isSupervisor(user.id);
    if (!sup) return res.status(403).json({ error: 'Supervisor access required.' });

    const logs = await readData('logs.json');
    const log  = logs.find(l => l.id === req.params.id);
    if (!log) return res.status(404).json({ error: 'Log not found.' });

    log.voided     = true;
    log.voidedBy   = user.username;
    log.voidedById = user.id;
    log.voidedAt   = Date.now();
    await writeData('logs.json', logs);
    res.json({ success: true });
});

// ─── Delete a log (supervisor only) ───────────────────────────────────────────

router.delete('/log/:id', async (req, res) => {
    const user = req.session.user;
    const sup  = await isSupervisor(user.id);
    if (!sup) return res.status(403).json({ error: 'Supervisor access required to delete logs.' });
    let logs = await readData('logs.json');
    const exists = logs.find(l => l.id === req.params.id);
    if (!exists) return res.status(404).json({ error: 'Log not found.' });
    logs = logs.filter(l => l.id !== req.params.id);
    await writeData('logs.json', logs);
    res.json({ success: true });
});

// ─── Submit Warrant ───────────────────────────────────────────────────────────

router.post('/log/warrant', async (req, res) => {
    const { username, wantedFor, additionalInfo } = req.body;
    const user    = req.session.user;
    const id      = generateId();

    const roblox    = await getRobloxUser(username);
    const headshot  = roblox ? await getRobloxHeadshot(roblox.id) : null;
    const robloxUrl = roblox ? roblox.url : null;

    const warrants = await readData('warrants.json');
    warrants.push({ id, username, wantedFor, additionalInfo: additionalInfo || null, issuedBy: user.username, issuedById: user.id, timestamp: Date.now(), status: 'active', robloxUrl, headshot });
    await writeData('warrants.json', warrants);

    res.json({ success: true, id });
});

router.patch('/warrant/:id/complete', async (req, res) => {
    const warrants = await readData('warrants.json');
    const w        = warrants.find(x => x.id === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    w.status = 'completed';
    await writeData('warrants.json', warrants);
    res.json({ success: true });
});

router.delete('/warrant/:id', async (req, res) => {
    const user = req.session.user;
    const sup  = await isSupervisor(user.id);
    if (!sup) return res.status(403).json({ error: 'Supervisor access required to delete warrants.' });
    let warrants = await readData('warrants.json');
    warrants     = warrants.filter(x => x.id !== req.params.id);
    await writeData('warrants.json', warrants);
    res.json({ success: true });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

router.get('/notes', async (req, res) => {
    const all = await readData('notes.json');
    res.json(all.filter(n => n.userId === req.session.user.id));
});

router.post('/notes', async (req, res) => {
    const { note } = req.body;
    const user     = req.session.user;
    const id       = generateId();
    const notes    = await readData('notes.json');
    notes.push({ id, note, userId: user.id, username: user.username, timestamp: Date.now() });
    await writeData('notes.json', notes);
    res.json({ success: true, id });
});

router.delete('/notes/:id', async (req, res) => {
    let notes = await readData('notes.json');
    notes     = notes.filter(n => !(n.id === req.params.id && n.userId === req.session.user.id));
    await writeData('notes.json', notes);
    res.json({ success: true });
});

// ─── Roblox lookup ────────────────────────────────────────────────────────────

router.get('/roblox/headshot/:username', async (req, res) => {
    const roblox = await getRobloxUser(req.params.username);
    if (!roblox) return res.json({ headshot: null });
    const headshot = await getRobloxHeadshot(roblox.id);
    res.json({ headshot, url: roblox.url });
});

// Full profile lookup for Search tab
router.get('/roblox/profile/:username', async (req, res) => {
    const username = req.params.username;
    const roblox   = await getRobloxUser(username);
    if (!roblox) return res.status(404).json({ error: 'User not found' });

    const [headshot, fullAvatar] = await Promise.all([
        getRobloxHeadshot(roblox.id),
        getRobloxFullAvatar(roblox.id),
    ]);

    // Pull citation/arrest history and warrants for this username
    const logs     = await readData('logs.json');
    const warrants = await readData('warrants.json');

    const citations = logs.filter(l => l.type === 'citation' && l.username.toLowerCase() === username.toLowerCase());
    const arrests   = logs.filter(l => l.type === 'arrest'   && l.username.toLowerCase() === username.toLowerCase());
    const activeWarrants = warrants.filter(w => w.username.toLowerCase() === username.toLowerCase() && w.status === 'active');

    res.json({
        username,
        robloxId:  roblox.id,
        robloxUrl: roblox.url,
        headshot,
        fullAvatar,
        citations,
        arrests,
        activeWarrants,
    });
});

// Plate lookup — checks live ER:LC server vehicles first, then falls back to citation logs
router.get('/search/plate/:plate', async (req, res) => {
    const plate = req.params.plate.toUpperCase();
    const logs  = await readData('logs.json');

    // ── 1. Query live ER:LC vehicles ──────────────────────────────────────────
    let liveVehicle = null;
    let liveOwnerUsername = null;
    try {
        const erlcRes  = await fetch('https://api.erlc.gg/v2/server?Vehicles=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const erlcData = await erlcRes.json();
        const vehicles = Array.isArray(erlcData.Vehicles) ? erlcData.Vehicles : [];

        // ER:LC vehicle objects: { Name, Owner, Plate, ... }
        const match = vehicles.find(v => v.Plate && v.Plate.toUpperCase() === plate);
        if (match) {
            liveVehicle       = match;
            liveOwnerUsername = match.Owner || null; // Roblox username of the driver
        }
    } catch (_) { /* ER:LC unavailable — fall through to logs */ }

    // ── 2. Find citation-log history for this plate ────────────────────────────
    const logMatches = logs
        .filter(l => l.type === 'citation' && l.licensePlate && l.licensePlate.toUpperCase() === plate)
        .sort((a, b) => b.timestamp - a.timestamp);

    // Determine which username to look up — prefer live driver, else last citation owner
    const resolvedUsername = liveOwnerUsername || (logMatches.length ? logMatches[0].username : null);

    if (!liveVehicle && !logMatches.length) return res.json({ found: false });

    // ── 3. Resolve Roblox profile ──────────────────────────────────────────────
    const roblox = resolvedUsername ? await getRobloxUser(resolvedUsername) : null;
    const [headshot, fullAvatar] = roblox ? await Promise.all([
        getRobloxHeadshot(roblox.id),
        getRobloxFullAvatar(roblox.id),
    ]) : [null, null];

    const allLogs  = await readData('logs.json');
    const warrants = await readData('warrants.json');

    const username = resolvedUsername || 'Unknown';
    const citations      = allLogs.filter(l => l.type === 'citation' && l.username.toLowerCase() === username.toLowerCase());
    const arrests        = allLogs.filter(l => l.type === 'arrest'   && l.username.toLowerCase() === username.toLowerCase());
    const activeWarrants = warrants.filter(w => w.username.toLowerCase() === username.toLowerCase() && w.status === 'active');

    // Vehicle details: live data takes priority, log data as fallback
    const vehicleName = liveVehicle?.Name  || logMatches[0]?.vehicle      || null;
    const vehicleColor= liveVehicle?.Color || logMatches[0]?.color        || null;
    const vehiclePlate= liveVehicle?.Plate || logMatches[0]?.licensePlate || plate;

    res.json({
        found:      true,
        liveInGame: !!liveVehicle,           // flag for frontend badge
        vehicle:    vehicleName,
        plate:      vehiclePlate,
        color:      vehicleColor,
        owner: {
            username,
            robloxId:    roblox?.id  || null,
            robloxUrl:   roblox?.url || null,
            headshot,
            fullAvatar,
            citations,
            arrests,
            activeWarrants,
        },
    });
});

// ─── Log export (supervisor only) ─────────────────────────────────────────────

router.get('/export/logs', async (req, res) => {
    const user = req.session.user;
    const sup  = await isSupervisor(user.id);
    if (!sup) return res.status(403).json({ error: 'Supervisor access required.' });

    const logs = await readData('logs.json');
    const type = req.query.type;
    const filtered = type ? logs.filter(l => l.type === type) : logs;

    const header = ['id','type','department','username','issuedBy','timestamp','voided','citedFor','fineAmount','vehicle','licensePlate','color','charges','leos','location','description'];
    const rows = filtered.map(l => header.map(h => {
        const v = l[h];
        if (v === undefined || v === null) return '';
        if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g,'""')}"`;
        return v;
    }).join(','));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="logs-export-${Date.now()}.csv"`);
    res.send([header.join(','), ...rows].join('\n'));
});

// ─── Map image proxy ──────────────────────────────────────────────────────────
router.get('/map-image', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/images/erlc-map.webp'));
});

// ─── Profile overrides (manual edits to skin/hair/height/gender) ──────────────

router.get('/profile-overrides/:username', async (req, res) => {
    const overrides = await readData('profile-overrides.json');
    const entry = overrides.find(o => o.username.toLowerCase() === req.params.username.toLowerCase());
    res.json(entry ? entry.fields : {});
});

router.post('/profile-overrides/:username', async (req, res) => {
    const { skin, hair, height, gender } = req.body;
    const username = req.params.username;
    let overrides = await readData('profile-overrides.json');
    const idx = overrides.findIndex(o => o.username.toLowerCase() === username.toLowerCase());
    const fields = { skin: skin || '', hair: hair || '', height: height || '', gender: gender || '' };
    if (idx >= 0) {
        overrides[idx].fields = fields;
        overrides[idx].updatedAt = Date.now();
    } else {
        overrides.push({ username, fields, updatedAt: Date.now() });
    }
    await writeData('profile-overrides.json', overrides);
    res.json({ success: true });
});

module.exports = router;
