import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { handleBet, handleGetBets, handleGetResult, handleConfirm, handlePool } from './api.ts';
import { queryNeon } from './db.ts';

// Console overrides to reduce noise
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

console.warn = (...args) => {
    if (String(args[0] || '').includes('NIP-04 encryption')) return;
    originalWarn(...args);
};

console.log = (...args) => {
    if (String(args[0] || '').includes('[Neon] Execute')) return;
    originalLog(...args);
};

console.error = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('relay.getalby.com') || msg.includes('Failed to connect')) {
        originalLog('[NWC] Connection error with Alby');
        return;
    }
    originalError(...args);
};

const app = express();
app.use(express.json());

let cachedBlock = { height: 890000, target: 890021 };

async function syncBlockHeight() {
    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            cachedBlock.height = height;
            cachedBlock.target = (Math.floor(height / 21) + 1) * 21;
        }
    } catch {}
}

setInterval(syncBlockHeight, 21000);
syncBlockHeight();

// API Routes
app.get('/api/blocks/tip', (_req, res) => res.json(cachedBlock));
app.post('/api/bet', (req, res) => handleBet(req, res, cachedBlock));
app.get('/api/bets', handleGetBets);
app.get('/api/result', handleGetResult);
app.post('/api/confirm', handleConfirm);
app.get('/api/pool', handlePool);

app.get('/api/identity/:pubkey', async (req, res) => {
    try {
        const rows = await queryNeon('SELECT alias FROM lotto_identities WHERE pubkey = $1', [req.params.pubkey]);
        res.json({ alias: rows[0]?.alias || null });
    } catch {
        res.json({ alias: null });
    }
});

// Amber Deep Link Fix: Redirect /<pubkey> back to /?pubkey=<pubkey>
app.get('/:hex', (req, res, next) => {
    const { hex } = req.params;
    if (/^[a-fA-F0-9]{60,}$/.test(hex)) return res.redirect(`/?pubkey=${hex}`);
    next();
});

createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then(async (vite) => {
    app.use(vite.middlewares);
    const port = 5173;
    app.listen(port, '0.0.0.0', () => {
        console.log(`➜  Server running on http://localhost:${port}/`);
        console.log(`➜  Neon DB Proxy: ${process.env.NEON_URL ? 'Enabled' : 'Disabled'}`);
    });
});
