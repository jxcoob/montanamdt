const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const fs             = require('fs');
const authRoutes     = require('./routes/auth');
const apiRoutes      = require('./routes/api');
const { requireAuth } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// Ensure data dir exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
['logs.json', 'warrants.json', 'notes.json'].forEach(f => {
    const fp = path.join(DATA_DIR, f);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify([]));
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'mdt-secret-key',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 48 * 60 * 60 * 1000 } // 48 hours
}));

app.use('/auth', authRoutes);
app.use('/api',  requireAuth, apiRoutes);

// Protected main app
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Denied page
app.get('/denied', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'denied.html'));
});

app.listen(PORT, () => console.log(`[MDT] Server running on port ${PORT}`));
