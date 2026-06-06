/**
 * db.js — MongoDB-backed persistence layer for Montana MDT
 *
 * Uses mongoose + a free MongoDB Atlas cluster (set MONGODB_URI in env).
 * Exposes the same readData / writeData API so no route logic changes.
 *
 * Setup:
 *   1. Create a free cluster at https://cloud.mongodb.com
 *   2. Get your connection string (looks like mongodb+srv://...)
 *   3. Add it as MONGODB_URI in your Render environment variables
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('[DB] ❌  MONGODB_URI env var is not set. Data will NOT persist across restarts.');
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// One generic "store" collection — each document is a named JSON array,
// identical in shape to the old flat files (logs.json, warrants.json, etc.)

const storeSchema = new mongoose.Schema({
    name:    { type: String, required: true, unique: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: true });

const Store = mongoose.model('Store', storeSchema);

// ─── Connect ──────────────────────────────────────────────────────────────────
let connected = false;

async function connect() {
    if (connected || !MONGODB_URI) return;
    await mongoose.connect(MONGODB_URI, { dbName: 'montanamdt' });
    connected = true;
    console.log('[DB] ✅  Connected to MongoDB');

    // Seed empty collections if they don't exist yet
    const collections = ['logs', 'warrants', 'notes', 'profile-overrides'];
    for (const name of collections) {
        await Store.findOneAndUpdate(
            { name },
            { $setOnInsert: { name, payload: [] } },
            { upsert: true, new: false }
        );
    }
}

connect().catch(err => console.error('[DB] Connection error:', err.message));

// ─── In-memory fallback cache (used if MongoDB is unavailable) ────────────────
const memCache = { logs: [], warrants: [], notes: [], 'profile-overrides': [] };

// ─── Public helpers ───────────────────────────────────────────────────────────

function normName(nameOrFile) {
    return nameOrFile.replace(/\.json$/, '');
}

/**
 * readData('logs') → Array  (async)
 */
async function readData(nameOrFile) {
    const name = normName(nameOrFile);
    if (!connected) return memCache[name] || [];
    try {
        const doc = await Store.findOne({ name }).lean();
        return doc ? doc.payload : [];
    } catch (err) {
        console.error('[DB] readData error:', err.message);
        return memCache[name] || [];
    }
}

/**
 * writeData('logs', rows)  (async)
 */
async function writeData(nameOrFile, data) {
    const name = normName(nameOrFile);
    memCache[name] = data; // always update in-memory copy
    if (!connected) return;
    try {
        await Store.findOneAndUpdate(
            { name },
            { payload: data },
            { upsert: true }
        );
    } catch (err) {
        console.error('[DB] writeData error:', err.message);
    }
}

module.exports = { Store, connect, readData, writeData, MONGODB_URI };
