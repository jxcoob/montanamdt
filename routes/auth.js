const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BASE_URL      = process.env.BASE_URL || 'https://montanamdt.onrender.com';
const REDIRECT_URI  = `${BASE_URL}/auth/callback`;
const BOT_TOKEN     = process.env.TOKEN;

const MDT_ACCESS_GUILDS = [
    { guildId: '1490470605194137662', roleId: '1499985143853486130', name: 'Missoula City Police Department' },
    { guildId: '1498131736305860708', roleId: '1498131737450905795', name: 'Missoula County Sheriff\'s Office' },
    { guildId: '1490141856607113278', roleId: '1490377039746830372', name: 'Montana Highway Patrol' },
];

const UNIT_MAP_GUILDS = [
    { guildId: '1490470605194137662', roleId: '1499981495081767034' },
    { guildId: '1498131736305860708', roleId: '1498131737623007374' },
    { guildId: '1490141856607113278', roleId: '1490209610035105802' },
];

const SUPERVISOR_GUILD_ID = '1451707915286085706';
const SUPERVISOR_ROLE_ID  = '1469135279049933007';

router.get('/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id:     CLIENT_ID,
        redirect_uri:  REDIRECT_URI,
        response_type: 'code',
        scope:         'identify guilds.members.read',
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login?error=1');

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({
                client_id:     CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type:    'authorization_code',
                code,
                redirect_uri:  REDIRECT_URI,
            }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.redirect('/login?error=1');

        const accessToken = tokenData.access_token;

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const user = await userRes.json();

        let hasAccess     = false;
        let departments   = [];
        let hasUnitMap    = false;
        let isSupervisor  = false;

        for (const g of MDT_ACCESS_GUILDS) {
            const memberRes = await fetch(
                `https://discord.com/api/guilds/${g.guildId}/members/${user.id}`,
                { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
            );
            if (memberRes.ok) {
                const member = await memberRes.json();
                if (member.roles && member.roles.includes(g.roleId)) {
                    hasAccess = true;
                    departments.push({ guildId: g.guildId, name: g.name, roleId: g.roleId });
                }
            }
        }

        if (!hasAccess) return res.redirect('/denied');

        // Check supervisor role in main server (separate guild, not in MDT_ACCESS_GUILDS)
        try {
            const supRes = await fetch(
                `https://discord.com/api/guilds/${SUPERVISOR_GUILD_ID}/members/${user.id}`,
                { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
            );
            if (supRes.ok) {
                const supMember = await supRes.json();
                if (supMember.roles && supMember.roles.includes(SUPERVISOR_ROLE_ID)) {
                    isSupervisor = true;
                }
            }
        } catch (_) {}

        for (const g of UNIT_MAP_GUILDS) {
            const memberRes = await fetch(
                `https://discord.com/api/guilds/${g.guildId}/members/${user.id}`,
                { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
            );
            if (memberRes.ok) {
                const member = await memberRes.json();
                if (member.roles && member.roles.includes(g.roleId)) {
                    hasUnitMap = true;
                    break;
                }
            }
        }

        req.session.user = {
            id:          user.id,
            username:    user.username,
            avatar:      user.avatar,
            departments,
            hasUnitMap,
            isSupervisor,
        };
        req.session.loginTime = Date.now();

        res.redirect('/');
    } catch (err) {
        console.error('[AUTH] Callback error:', err);
        res.redirect('/login?error=1');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
