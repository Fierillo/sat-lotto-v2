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
            const tableQuery = `
                CREATE TABLE IF NOT EXISTS lotto_bets (
                    id SERIAL PRIMARY KEY,
                    pubkey VARCHAR(64) NOT NULL,
                    target_block INT NOT NULL,
                    selected_number INT NOT NULL,
                    payment_request TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `;
            await queryNeon(tableQuery, []);

            const insertQuery = `
                INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request)
                VALUES ($1, $2, $3, $4)
            `;
            await queryNeon(insertQuery, [signedEvent.pubkey, bet.bloque, bet.numero, pr]);
        }

        res.json({ paymentRequest: pr });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bets', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });

    try {
        const query = `
            SELECT pubkey, selected_number, created_at
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
            SELECT pubkey, selected_number
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
});

createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
    .then(vite => {
        app.use(vite.middlewares);
        app.listen(5173, '0.0.0.0', () => console.log(`\n  ➜  Local:   http://localhost:5173/`));
    })
    .catch(console.error);
