import 'dotenv/config';

const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

console.warn = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('NIP-04 encryption is about to be deprecated')) return;
    originalWarn(...args);
};

console.log = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('[Neon] Execute')) return;
    originalLog(...args);
};

console.error = (...args) => {
    const msg = String(args[0] || '');
    if (msg.includes('relay.getalby.com') || msg.includes('Failed to connect') || msg.includes('Failed to request')) {
        originalLog('[NWC] Error de conexión con Alby');
        return;
    }
    originalError(...args);
};

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyEvent } from 'nostr-tools';
import { nwc } from '@getalby/sdk';
import { neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
import { queryNeon } from './api/neon.ts';
import { createNwcInvoice } from './src/utils/create-invoice.ts';
import { lookupNwcInvoice } from './src/utils/pay-invoice.ts';

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
    } catch { }
}

// Initial sync and then every 21s
syncBlockHeight();
setInterval(syncBlockHeight, 21000);

app.get('/api/blocks/tip', (_req, res) => {
    res.json(cachedBlock);
});

// Amber Deep Link Fix: Redirect /<pubkey> back to /?pubkey=<pubkey>
app.get('/:hex', (req, res, next) => {
    const { hex } = req.params;
    if (/^[a-fA-F0-9]{60,}$/.test(hex)) {
        return res.redirect(`/?pubkey=${hex}`);
    }
    next();
});

import fs from 'fs';
const LOG_FILE = 'tests/mobile_debug.log';
const logToFile = (entry: string) => {
    fs.appendFileSync(LOG_FILE, entry);
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
    if (lines.length > 210) fs.writeFileSync(LOG_FILE, lines.slice(-210).join('\n'));
};

app.post('/api/debug', (req, res) => {
    logToFile(`[${new Date().toISOString()}] ${JSON.stringify(req.body, null, 2)}\n---\n`);
    res.sendStatus(200);
});

async function setupDb() {
    if (process.env.NEON_URL?.includes('user:password')) return;
    try {
        await queryNeon(`
            CREATE TABLE IF NOT EXISTS lotto_bets (
                id SERIAL PRIMARY KEY,
                pubkey VARCHAR(64) NOT NULL,
                target_block INT NOT NULL,
                selected_number INT NOT NULL,
                payment_request TEXT,
                payment_hash VARCHAR(64),
                is_paid BOOLEAN DEFAULT FALSE,
                betting_block INT,
                alias VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `, []);

        // Migration: Add columns individually
        await queryNeon("ALTER TABLE lotto_bets ADD COLUMN IF NOT EXISTS payment_hash VARCHAR(64)", []);
        await queryNeon("ALTER TABLE lotto_bets ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE", []);
        await queryNeon("ALTER TABLE lotto_bets ADD COLUMN IF NOT EXISTS betting_block INT", []);
        await queryNeon("ALTER TABLE lotto_bets ADD COLUMN IF NOT EXISTS alias VARCHAR(255)", []);

        // Migration: identities table
        await queryNeon(`
            CREATE TABLE IF NOT EXISTS lotto_identities (
                pubkey VARCHAR(64) PRIMARY KEY,
                alias VARCHAR(255),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `, []);

        // Ensure unique constraint
        await queryNeon(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_pubkey_block') THEN
                    ALTER TABLE lotto_bets ADD CONSTRAINT unique_pubkey_block UNIQUE (pubkey, target_block);
                END IF;
            END $$;
        `, []);
        console.log("[DB] Database setup complete");
    } catch (e) {
        console.error("[DB] Setup error:", e);
    }
}

app.post('/api/bet', async (req, res) => {
    try {
        let { signedEvent, pubkey, bet: rawBet, alias: rawAlias } = req.body;
        let finalPubkey, finalBloque, finalNumero, finalAlias;

        if (signedEvent) {
            if (typeof signedEvent === 'string') {
                try { signedEvent = JSON.parse(signedEvent); } catch { }
            }
            if (!signedEvent || typeof signedEvent !== 'object' || !verifyEvent(signedEvent)) {
                return res.status(400).json({ error: 'Invalid signed event' });
            }
            const betContent = JSON.parse(signedEvent.content);
            finalPubkey = signedEvent.pubkey;
            finalBloque = betContent.bloque;
            finalNumero = betContent.numero;
            finalAlias = betContent.alias;
        } else if (pubkey && rawBet) {
            finalPubkey = pubkey;
            finalBloque = rawBet.bloque;
            finalNumero = rawBet.numero;
            finalAlias = rawAlias;
        } else {
            return res.status(400).json({ error: 'Missing signedEvent or pubkey+bet' });
        }

        if (!finalBloque || !finalNumero) {
            return res.status(400).json({ error: 'Missing block or number' });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server missing NWC' });

        const invoice: any = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`).catch(e => {
            logToFile(`[NWC ERROR] ${e.message}\n`);
            return null;
        });

        if (!invoice) return res.status(500).json({ error: 'Could not generate invoice' });

        const pr = invoice.payment_request || invoice.paymentRequest || invoice.invoice;
        const paymentHash = invoice.payment_hash || invoice.paymentHash || invoice.hash;

        logToFile(`[NWC SUCCESS] PR: ${pr?.slice(0, 20)}... Hash: ${paymentHash}\n`);

        if (!process.env.NEON_URL?.includes('user:password')) {
            if (!finalAlias) {
                const identities = await queryNeon('SELECT alias FROM lotto_identities WHERE pubkey = $1', [finalPubkey]);
                if (identities.length) finalAlias = identities[0].alias;
            }

            const upsertBet = `
                INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias)
                VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
                ON CONFLICT (pubkey, target_block) 
                DO UPDATE SET selected_number = EXCLUDED.selected_number, 
                             payment_request = EXCLUDED.payment_request,
                             payment_hash = EXCLUDED.payment_hash,
                             is_paid = FALSE,
                             betting_block = EXCLUDED.betting_block,
                             alias = EXCLUDED.alias,
                             created_at = NOW()
            `;
            await queryNeon(upsertBet, [finalPubkey, finalBloque, finalNumero, pr, paymentHash, cachedBlock.height, finalAlias]);

            if (finalAlias && !signedEvent) {
                // Keep local alias storage updated if sent directly
                const upsertIdentity = `
                    INSERT INTO lotto_identities (pubkey, alias, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (pubkey) DO UPDATE SET alias = EXCLUDED.alias, updated_at = NOW()
                `;
                await queryNeon(upsertIdentity, [finalPubkey, finalAlias]);
            }
        }

        return res.json({ paymentRequest: pr, paymentHash });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/bets', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });

    try {
        const query = `
            SELECT b.pubkey, b.selected_number, i.alias, b.created_at
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 
              AND b.is_paid = TRUE 
              AND b.betting_block >= ($1 - 21)
            ORDER BY b.created_at DESC
        `;
        let bets = [];
        if (!process.env.NEON_URL?.includes('user:password')) {
            bets = await queryNeon(query, [block]);
        }
        return res.json({ bets });
    } catch (e: any) {
        if (e.message.includes('42P01') || e.message.includes('42703')) return res.json({ bets: [] });
        return res.status(500).json({ error: e.message });
    }
});

app.get('/api/result', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block param' });

    try {
        const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
        if (!resp.ok) return res.json({ resolved: false });
        const hash = (await resp.text()).trim();

        // 100% Deterministic Winner: BigInt handles 256 bits precisely. Result is always 1-21.
        const winningNumber = Number((BigInt('0x' + hash) % 21n) + 1n);

        const query = `
            SELECT b.pubkey, b.selected_number, i.alias
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 
              AND b.selected_number = $2 
              AND b.is_paid = TRUE
              AND b.betting_block >= ($1 - 21)
        `;
        let winners = [];
        if (!process.env.NEON_URL?.includes('user:password')) {
            winners = await queryNeon(query, [block, winningNumber]);
        }

        return res.json({ resolved: true, blockHash: hash, winningNumber, winners, targetBlock: block });
    } catch (err: any) {
        if (err.message.includes('42P01') || err.message.includes('42703')) {
            return res.json({ resolved: true, blockHash: '', winningNumber: 0, winners: [], targetBlock: block });
        }
        return res.json({ resolved: true, winners: [], error: err.message, targetBlock: block });
    }
});

app.get('/api/identity/:pubkey', async (req, res) => {
    try {
        const rows = await queryNeon('SELECT alias FROM lotto_identities WHERE pubkey = $1', [req.params.pubkey]);
        res.json({ alias: rows[0]?.alias || null });
    } catch {
        res.json({ alias: null });
    }
});

app.post('/api/confirm', async (req, res) => {
    try {
        const { paymentHash } = req.body;
        if (!paymentHash) return res.status(400).json({ error: 'Missing payment hash' });

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server missing NWC' });

        const tx = await lookupNwcInvoice(nwcUrl, paymentHash);

        if (tx && ((tx as any).settled || tx.preimage)) {
            await queryNeon('UPDATE lotto_bets SET is_paid = TRUE WHERE payment_hash = $1', [paymentHash]);
            return res.json({ confirmed: true });
        }

        return res.status(400).json({ error: 'Invoice not settled yet' });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/pool', async (_req, res) => {
    let client;
    try {
        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.json({ balance: 0 });

        client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        const balanceData = await client.getBalance();
        res.json({ balance: Math.floor(balanceData.balance / 1000) }); // msats to sats
    } catch (err: any) {
        // Silencio en la UI pero log corto en el terminal si no es spam
        const msg = err.message || '';
        if (!msg.includes('getalby')) originalLog('[NWC] Fetch balance failed');
        return res.json({ balance: 0, error: 'Connection issues' });
    } finally {
        if (client) client.close();
    }
    return;
});

createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
    .then(async (vite) => {
        await setupDb();
        app.use(vite.middlewares);
        app.listen(5173, '0.0.0.0', () => {
            console.log(`\n  ➜  Local:   http://localhost:5173/`);
        });
    })
    .catch(console.error);
