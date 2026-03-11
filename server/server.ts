import 'dotenv/config';
import express from 'express';
import { handleBet, handleGetBets, handleGetResult, handleConfirm, handleVerifyIdentity, getPoolBalance, processPayouts, startBotListener } from './api.ts';
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
    
    // Sanitize any potential NWC Secret in errors
    let sanitizedArgs = args.map(arg => {
        if (typeof arg === 'string') {
            return arg.replace(/secret=[a-f0-9]+/gi, 'secret=REDACTED')
                      .replace(/nostr\+walletconnect:\/\/[^"'\s]+/gi, 'nwc://REDACTED');
        }
        return arg;
    });

    originalError(...sanitizedArgs);
};

const app = express();
app.use(express.json());

// Basic Rate Limiting for identity verification
const identityRateLimit: Record<string, number> = {};
setInterval(() => {
    // Clear limit every hour
    for (const key in identityRateLimit) delete identityRateLimit[key];
}, 3600000);

let cachedBlock = { height: 890000, target: 890021, poolBalance: 0 };

async function syncData() {
    // Sync Block Height
    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            cachedBlock.height = height;
            cachedBlock.target = (Math.floor(height / 21) + 1) * 21;
        }
    } catch (e) {
        console.error('[Sync] Block height fetch failed');
    }

    // Sync Pool Balance (Single source of truth, avoids open DDoS vector)
    try {
        const bal = await getPoolBalance();
        if (bal !== cachedBlock.poolBalance) {
            console.log(`[Sync] Pool balance updated: ${bal} sats`);
            cachedBlock.poolBalance = bal;
        }
    } catch (e) {
        // ERROR: If NWC fails (timeout), we KEEP the previous balance.
        console.error('[Sync] Pool balance fetch failed (keeping last known balance)');
    }

    // Payout Worker: Check for confirmed rounds (target + 2)
    try {
        await processPayouts(cachedBlock.height);
    } catch (e) {
        console.error('[PayoutWorker] Error:', e);
    }
}

setInterval(syncData, 21000);
syncData();
startBotListener(); // Iniciar el "oído" del bot

// API Routes
app.get('/api/blocks/tip', (_req, res) => {
    // Return net balance (post-fee)
    const netBalance = Math.floor(cachedBlock.poolBalance * 0.958);
    res.json({ ...cachedBlock, poolBalance: netBalance });
});

app.post('/api/bet', (req, res) => handleBet(req, res, cachedBlock));
app.get('/api/bets', handleGetBets);
app.get('/api/result', handleGetResult);
app.post('/api/confirm', handleConfirm);
app.post('/api/identity/verify', (req, res) => {
    const ip = req.ip || 'unknown';
    identityRateLimit[ip] = (identityRateLimit[ip] || 0) + 1;
    if (identityRateLimit[ip] > 10) return res.status(429).json({ error: 'Rate limit exceeded' });
    return handleVerifyIdentity(req, res);
});

app.get('/api/identity/:pubkey', async (req, res) => {
    try {
        const rows = await queryNeon(`
            SELECT alias, last_celebrated_block 
            FROM lotto_identities WHERE pubkey = $1
            LIMIT 1
        `, [req.params.pubkey]);

        res.json({ 
            alias: rows[0]?.alias || null,
            lastCelebrated: rows[0]?.last_celebrated_block || 0 
        });
    } catch {
        res.json({ alias: null, lastCelebrated: 0 });
    }
});

// Amber Deep Link Fix: Redirect /<pubkey> back to /?pubkey=<pubkey>
app.get('/:hex', (req, res, next) => {
    const { hex } = req.params;
    if (/^[a-fA-F0-9]{60,}$/.test(hex)) return res.redirect(`/?pubkey=${hex}`);
    next();
});

export default app;

if (process.env.VERCEL !== '1') {
    const { createServer: createViteServer } = await import('vite');
    const { createServer: createHttpServer } = await import('http');

    const port = 5173;
    const httpServer = createHttpServer(app);

    createViteServer({ 
        server: { 
            middlewareMode: true,
            hmr: { server: httpServer }
        }, 
        appType: 'spa' 
    }).then(async (vite) => {
        app.use(vite.middlewares);
        httpServer.listen(port, '0.0.0.0', () => {
            console.log(`➜  Server running on http://localhost:${port}/`);
            console.log(`➜  Neon DB Proxy: ${process.env.NEON_URL ? 'Enabled' : 'Disabled'}`);
        });
    });
}
