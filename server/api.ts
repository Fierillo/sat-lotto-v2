import { queryNeon } from './db.ts';
import { verifyEvent } from 'nostr-tools';
import { createNwcInvoice } from '../src/utils/create-invoice.ts';
import { lookupNwcInvoice } from '../src/utils/pay-invoice.ts';
import { nwc } from '@getalby/sdk';

export const handleBet = async (req: any, res: any, cachedBlock: any) => {
    try {
        let { signedEvent, pubkey, bet: rawBet, alias: rawAlias } = req.body;
        let finalPubkey, finalBloque, finalNumero, finalAlias;

        if (signedEvent) {
            const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;
            if (!verifyEvent(event)) return res.status(400).json({ error: 'Invalid event' });
            const betContent = JSON.parse(event.content);
            finalPubkey = event.pubkey;
            finalBloque = betContent.bloque;
            finalNumero = betContent.numero;
            finalAlias = betContent.alias;
        } else {
            finalPubkey = pubkey;
            finalBloque = rawBet.bloque;
            finalNumero = rawBet.numero;
            finalAlias = rawAlias;
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server missing NWC' });

        const invoice: any = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`);
        const pr = invoice?.payment_request || invoice?.paymentRequest;
        const hash = invoice?.payment_hash || invoice?.paymentHash;

        if (!pr) return res.status(500).json({ error: 'Could not generate invoice' });

        await queryNeon(`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
            ON CONFLICT (pubkey, target_block) DO UPDATE SET 
                selected_number = EXCLUDED.selected_number, 
                payment_request = EXCLUDED.payment_request,
                payment_hash = EXCLUDED.payment_hash,
                is_paid = FALSE,
                betting_block = EXCLUDED.betting_block,
                alias = EXCLUDED.alias,
                created_at = NOW()
        `, [finalPubkey, finalBloque, finalNumero, pr, hash, cachedBlock.height, finalAlias]);

        return res.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
};

export const handleGetBets = async (req: any, res: any) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });
    const bets = await queryNeon(`
        SELECT b.pubkey, b.selected_number, i.alias, b.created_at
        FROM lotto_bets b
        LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
        WHERE b.target_block = $1 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
        ORDER BY b.created_at DESC
    `, [block]);
    res.json({ bets });
};

export const handleGetResult = async (req: any, res: any) => {
    const block = parseInt(req.query.block as string);
    const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
    if (!resp.ok) return res.json({ resolved: false });
    const hash = (await resp.text()).trim();
    const winningNumber = Number((BigInt('0x' + hash) % 21n) + 1n);
    const winners = await queryNeon(`
        SELECT b.pubkey, b.selected_number, i.alias
        FROM lotto_bets b
        LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
        WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
    `, [block, winningNumber]);
    res.json({ resolved: true, blockHash: hash, winningNumber, winners, targetBlock: block });
};

export const handleConfirm = async (req: any, res: any) => {
    const { paymentHash } = req.body;
    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl || !paymentHash) return res.status(400).json({ error: 'Missing data' });
    const tx = await lookupNwcInvoice(nwcUrl, paymentHash);
    if (tx && ((tx as any).settled || tx.preimage)) {
        await queryNeon('UPDATE lotto_bets SET is_paid = TRUE WHERE payment_hash = $1', [paymentHash]);
        return res.json({ confirmed: true });
    }
    res.status(400).json({ error: 'Not settled' });
};

export const handlePool = async (_req: any, res: any) => {
    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return res.json({ balance: 0 });
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const balanceData = await client.getBalance();
        res.json({ balance: Math.floor(balanceData.balance / 1000) });
    } finally {
        client.close();
    }
};
