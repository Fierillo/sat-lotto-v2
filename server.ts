import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyEvent } from 'nostr-tools';
import { nwc } from '@getalby/sdk';
import { neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
import { queryNeon } from './api/neon.ts';

const app = express();
app.use(express.json());

let cachedBlock = { height: 890000, target: 890000 + 21 };

async function syncBlockHeight() {
    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            cachedBlock.height = height;
            const remainder = height % 21;
            cachedBlock.target = height + (remainder === 0 ? 0 : 21 - remainder);
        }
    } catch (e) {
        console.error("[BlockSync] Error:", e);
    }
}

// Initial sync and then every 21s
syncBlockHeight();
setInterval(syncBlockHeight, 21000);

app.get('/api/blocks/tip', (_req, res) => {
    res.json(cachedBlock);
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
                alias VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `, []);

        // Migration: add alias column if it doesn't exist
        await queryNeon(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lotto_bets' AND column_name='alias') THEN
                    ALTER TABLE lotto_bets ADD COLUMN alias VARCHAR(255);
                END IF;
            END $$;
        `, []);

        // Clean duplicates if any, keeping the latest ID
        await queryNeon(`
            DELETE FROM lotto_bets a USING lotto_bets b
            WHERE a.id < b.id AND a.pubkey = b.pubkey AND a.target_block = b.target_block
        `, []);

        // Try adding the constraint if it doesn't exist
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
        console.error("[DB] Setup error (might be expected if already configured):", e);
    }
}

app.post('/api/bet', async (req, res) => {
    try {
        const { signedEvent } = req.body;
        if (!signedEvent || !verifyEvent(signedEvent)) {
            return res.status(400).json({ error: 'Invalid signed event' });
        }

        const bet = JSON.parse(signedEvent.content);
        if (!bet.bloque || !bet.numero) {
            return res.status(400).json({ error: 'Missing block or number' });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server missing NWC' });

        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        const invoice: any = await client.makeInvoice({
            amount: 21000,
            description: `SatLotto Block ${bet.bloque} - Num ${bet.numero}`
        });

        const pr = invoice.paymentRequest || invoice.invoice;

        if (!process.env.NEON_URL?.includes('user:password')) {
            const upsertQuery = `
                INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, alias)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (pubkey, target_block) 
                DO UPDATE SET selected_number = EXCLUDED.selected_number, 
                             payment_request = EXCLUDED.payment_request,
                             alias = EXCLUDED.alias,
                             created_at = NOW()
            `;
            await queryNeon(upsertQuery, [signedEvent.pubkey, bet.bloque, bet.numero, pr, bet.alias || null]);
        }

        res.json({ paymentRequest: pr });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
    return;
});

app.get('/api/bets', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });

    try {
        const query = `
            SELECT pubkey, selected_number, alias, created_at
            FROM lotto_bets
            WHERE target_block = $1
            ORDER BY created_at DESC
        `;
        let bets = [];
        if (!process.env.NEON_URL?.includes('user:password')) {
            bets = await queryNeon(query, [block]);
        }
        res.json({ bets });
    } catch (e: any) {
        if (e.message.includes('42P01')) return res.json({ bets: [] });
        res.status(500).json({ error: e.message });
    }
    return;
});

app.get('/api/result', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block param' });

    try {
        const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
        if (!resp.ok) return res.json({ resolved: false, message: 'Not mined yet' });

        const hash = await resp.text();
        const winningNumber = (parseInt(hash.slice(-4), 16) % 21) + 1;

        const query = `
            SELECT pubkey, selected_number, alias
            FROM lotto_bets
            WHERE target_block = $1 AND selected_number = $2
        `;
        let winners = [];
        if (!process.env.NEON_URL?.includes('user:password')) {
            winners = await queryNeon(query, [block, winningNumber]);
        }

        res.json({ resolved: true, blockHash: hash, winningNumber, winners });
    } catch (err: any) {
        if (err.message.includes('42P01')) {
            return res.json({ resolved: true, blockHash: '', winningNumber: 0, winners: [] });
        }
        res.json({ resolved: true, winners: [], error: err.message });
    }
    return;
});

app.get('/api/pool', async (_req, res) => {
    try {
        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.json({ balance: 0 });

        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        const balance = await client.getBalance();
        res.json({ balance: Math.floor(balance.balance / 1000) }); // msats to sats
    } catch (err: any) {
        res.json({ balance: 0, error: err.message });
    }
    return;
});

createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
    .then(async (vite) => {
        await setupDb();
        app.use(vite.middlewares);
        app.listen(5173, '0.0.0.0', () => console.log(`\n  ➜  Local:   http://localhost:5173/`));
    })
    .catch(console.error);
