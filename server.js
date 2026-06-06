const express         = require('express');
const session         = require('express-session');
const MongoStore      = require('connect-mongo');
const path            = require('path');
const authRoutes      = require('./routes/auth');
const apiRoutes       = require('./routes/api');
const { requireAuth } = require('./middleware/auth');
const keep_alive      = require('./keep_alive.js');
const { MONGODB_URI } = require('./db'); // triggers DB connection on startup

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'mdt-secret-key',
    resave:            false,
    saveUninitialized: false,
    cookie:            { maxAge: 48 * 60 * 60 * 1000 }, // 48 hours
    // Sessions stored in MongoDB — survive restarts & redeploys for free
    store: MONGODB_URI
        ? MongoStore.create({ mongoUrl: MONGODB_URI, dbName: 'montanamdt', collectionName: 'sessions' })
        : undefined, // falls back to in-memory if no URI set
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
