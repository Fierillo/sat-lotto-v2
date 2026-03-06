import express from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyEvent } from 'nostr-tools';
import { nwc } from '@getalby/sdk';

const app = express();
app.use(express.json());

const bets: any[] = [];

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

        bets.push({
            pubkey: signedEvent.pubkey,
            target_block: bet.bloque,
            selected_number: bet.numero,
            payment_request: pr,
            created_at: new Date()
        });

        res.json({ paymentRequest: pr });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bets', (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });

    const activeBets = bets
        .filter(b => b.target_block === block)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    res.json({ bets: activeBets });
});

app.get('/api/result', async (req, res) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block param' });

    try {
        const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
        if (!resp.ok) return res.json({ resolved: false, message: 'Not mined yet' });

        const hash = await resp.text();
        const winningNumber = (parseInt(hash.slice(-4), 16) % 21) + 1;

        const winners = bets.filter(b => b.target_block === block && b.selected_number === winningNumber);

        res.json({ resolved: true, blockHash: hash, winningNumber, winners });
    } catch (err: any) {
        res.json({ resolved: true, winners: [], error: err.message });
    }
});

createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
    .then(vite => {
        app.use(vite.middlewares);
        app.listen(5173, '0.0.0.0', () => console.log(`\n  ➜  Local:   http://localhost:5173/`));
    })
    .catch(console.error);
