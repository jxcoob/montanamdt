const express = require('express');
const fetch   = require('node-fetch');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const BOT_TOKEN  = process.env.TOKEN;
const ERLC_KEY   = process.env.ERLC_API_KEY;
const DATA_DIR   = path.join(__dirname, '..', 'data');

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

function readData(file) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
    catch { return []; }
}

function writeData(file, data) {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

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

// ─── Session / User info ──────────────────────────────────────────────────────

router.get('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.session.user);
});

// ─── ERLC ─────────────────────────────────────────────────────────────────────

router.get('/erlc/players', async (req, res) => {
    try {
        const r = await fetch('https://api.erlc.gg/v2/server?Players=true', {
            headers: { 'server-key': ERLC_KEY },
        });
        const data = await r.json();
        const players = data.Players || [];
        res.json(players);
    } catch (err) {
        console.error('[ERLC] Players error:', err.message);
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
        console.error('[ERLC] Calls error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get('/logs', (req, res) => {
    res.json(readData('logs.json'));
});

router.get('/warrants', (req, res) => {
    res.json(readData('warrants.json'));
});

// ─── Submit Citation ──────────────────────────────────────────────────────────

router.post('/log/citation', async (req, res) => {
    const { username, citedFor, fineAmount, department, vehicle, licensePlate, color } = req.body;
    const user = req.session.user;

    const dept = DEPT_CONFIG[department];
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    // Check user has role for that dept
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

    // Save log
    const logs = readData('logs.json');
    logs.push({ id, type: 'citation', department, username, citedFor, fineAmount, vehicle: vehicle || null, licensePlate: licensePlate || null, color: color || null, issuedBy: user.username, issuedById: user.id, timestamp: Date.now() });
    writeData('logs.json', logs);

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

    const logs = readData('logs.json');
    logs.push({ id, type: 'arrest', department, username, charges, issuedBy: user.username, issuedById: user.id, timestamp: Date.now() });
    writeData('logs.json', logs);

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

    const logs = readData('logs.json');
    logs.push({ id, type: 'incident', department, leos, location, description, issuedBy: user.username, issuedById: user.id, timestamp: Date.now() });
    writeData('logs.json', logs);

    res.json({ success: true, id });
});

// ─── Submit Warrant ───────────────────────────────────────────────────────────

router.post('/log/warrant', async (req, res) => {
    const { username, wantedFor, additionalInfo } = req.body;
    const user    = req.session.user;
    const id      = generateId();

    const roblox    = await getRobloxUser(username);
    const headshot  = roblox ? await getRobloxHeadshot(roblox.id) : null;
    const robloxUrl = roblox ? roblox.url : null;

    const warrants = readData('warrants.json');
    warrants.push({ id, username, wantedFor, additionalInfo: additionalInfo || null, issuedBy: user.username, issuedById: user.id, timestamp: Date.now(), status: 'active', robloxUrl, headshot });
    writeData('warrants.json', warrants);

    res.json({ success: true, id });
});

router.patch('/warrant/:id/complete', (req, res) => {
    const warrants = readData('warrants.json');
    const w        = warrants.find(x => x.id === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    w.status = 'completed';
    writeData('warrants.json', warrants);
    res.json({ success: true });
});

router.delete('/warrant/:id', (req, res) => {
    let warrants = readData('warrants.json');
    warrants     = warrants.filter(x => x.id !== req.params.id);
    writeData('warrants.json', warrants);
    res.json({ success: true });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

router.get('/notes', (req, res) => {
    const all = readData('notes.json');
    res.json(all.filter(n => n.userId === req.session.user.id));
});

router.post('/notes', (req, res) => {
    const { note } = req.body;
    const user     = req.session.user;
    const id       = generateId();
    const notes    = readData('notes.json');
    notes.push({ id, note, userId: user.id, username: user.username, timestamp: Date.now() });
    writeData('notes.json', notes);
    res.json({ success: true, id });
});

router.delete('/notes/:id', (req, res) => {
    let notes = readData('notes.json');
    notes     = notes.filter(n => !(n.id === req.params.id && n.userId === req.session.user.id));
    writeData('notes.json', notes);
    res.json({ success: true });
});

// ─── Roblox headshot for warrants ─────────────────────────────────────────────

router.get('/roblox/headshot/:username', async (req, res) => {
    const roblox = await getRobloxUser(req.params.username);
    if (!roblox) return res.json({ headshot: null });
    const headshot = await getRobloxHeadshot(roblox.id);
    res.json({ headshot, url: roblox.url });
});

// ─── Map image proxy (avoids CORS/hotlink block on PRC CDN) ──────────────────
router.get('/map-image', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/images/erlc-map.webp'));
});

module.exports = router;
