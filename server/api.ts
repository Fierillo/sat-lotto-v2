import { queryNeon } from './db.ts';
import { verifyEvent } from 'nostr-tools';
import { createNwcInvoice } from '../src/utils/create-invoice.ts';
import { lookupNwcInvoice } from '../src/utils/pay-invoice.ts';
import { nwc } from '@getalby/sdk';

const blockHashCache: Record<number, string> = {};

export const handleBet = async (req: any, res: any, cachedBlock: any) => {
    try {
        let { signedEvent } = req.body;
        
        // 1. Mandatory Signature (Anti-Identity Spoofing)
        if (!signedEvent) {
            return res.status(401).json({ error: 'Signature required to bet' });
        }

        const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;
        if (!verifyEvent(event)) {
            return res.status(400).json({ error: 'Invalid event signature' });
        }

        const betContent = JSON.parse(event.content);
        const finalPubkey = event.pubkey;
        const finalBloque = parseInt(betContent.bloque);
        const finalNumero = parseInt(betContent.numero);
        const finalAlias = betContent.alias;
        const eventId = event.id;
        const createdAt = event.created_at;

        // Anti-Replay: Check if event ID was already processed
        const existingEvent = await queryNeon('SELECT count(*) FROM lotto_bets WHERE nostr_event_id = $1', [eventId]);
        if (parseInt(existingEvent[0].count) > 0) {
            return res.status(409).json({ error: 'Esta apuesta ya fue procesada (Replay Attack protection)' });
        }

        // 2. Clock Drift Check (+/- 15 min)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - createdAt) > 900) {
            return res.status(400).json({ 
                error: 'Firma desincronizada. Verificá la fecha y hora de tu dispositivo para poder apostar.' 
            });
        }

        // 3. Validate Target Block (Anti-Jackpot Spoofing)
        if (finalBloque !== cachedBlock.target) {
            return res.status(400).json({ 
                error: `Invalid target block. Expected ${cachedBlock.target}, got ${finalBloque}` 
            });
        }

        // 3. Server-side Frozen Check (Anti-Last Second Betting)
        // Real-time height check to avoid 21s poll race condition
        const realTimeResp = await fetch('https://mempool.space/api/blocks/tip/height');
        const realTimeHeight = parseInt(await realTimeResp.text(), 10);
        
        const isFrozen = (realTimeHeight || cachedBlock.height) >= finalBloque - 2;
        if (isFrozen) {
            return res.status(403).json({ error: 'Betting is closed for this block (Fase Frozen)' });
        }

        // 4. Rate Limit (DDoS Protection) - basic per-pubkey unpaid limit
        const unpaidCount = await queryNeon('SELECT count(*) FROM lotto_bets WHERE pubkey = $1 AND is_paid = FALSE', [finalPubkey]);
        if (parseInt(unpaidCount[0].count) > 5) {
            return res.status(429).json({ error: 'Too many unpaid invoices. Pay your bets before requesting more.' });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server NWC_URL not configured in .env' });

        let invoice: any;
        try {
            console.log(`[NWC] Creating invoice for 21 sats... Block: ${finalBloque}, Num: ${finalNumero}`);
            invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`);
            console.log('[NWC] Response received:', JSON.stringify(invoice));
        } catch (e: any) {
            console.error('[NWC] makeInvoice failed:', e);
            return res.status(500).json({ error: `NWC error: ${e.message || 'unknown'}. Make sure your NWC connection has make_invoice permission.` });
        }

        const pr = (invoice as any).invoice || (invoice as any).payment_request || (invoice as any).paymentRequest;
        const hash = (invoice as any).payment_hash || (invoice as any).paymentHash;

        if (!pr) {
            console.error('[NWC] Empty invoice returned from NWC (no BOLT11 found in fields invoice/payment_request):', invoice);
            return res.status(500).json({ error: 'NWC returned an empty invoice (no BOLT11)' });
        }

        await queryNeon(`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias, nostr_event_id)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8)
            ON CONFLICT (pubkey, target_block) DO UPDATE SET 
                selected_number = EXCLUDED.selected_number, 
                payment_request = EXCLUDED.payment_request,
                payment_hash = EXCLUDED.payment_hash,
                is_paid = FALSE,
                betting_block = EXCLUDED.betting_block,
                alias = EXCLUDED.alias,
                nostr_event_id = EXCLUDED.nostr_event_id,
                created_at = NOW()
        `, [finalPubkey, finalBloque, finalNumero, pr, hash, cachedBlock.height, finalAlias, eventId]);

        if (finalAlias) {
            await queryNeon('INSERT INTO lotto_identities (pubkey, alias) VALUES ($1, $2) ON CONFLICT (pubkey) DO UPDATE SET alias = EXCLUDED.alias', [finalPubkey, finalAlias]);
        }

        return res.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        console.error('[handleBet] Internal Error:', err);
        return res.status(500).json({ error: err.message });
    }
};

export const handleGetBets = async (req: any, res: any) => {
    const block = parseInt(req.query.block as string);
    if (!block) return res.status(400).json({ error: 'Missing block' });
    const bets = await queryNeon(`
        SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias, b.created_at
        FROM lotto_bets b
        LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
        WHERE b.target_block = $1 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
        ORDER BY b.created_at DESC
    `, [block]);
    res.json({ bets });
};

export const handleGetResult = async (req: any, res: any) => {
    const block = parseInt(req.query.block as string);
    
    // Cache check to avoid redundant Mempool calls
    let hash = blockHashCache[block];
    if (!hash) {
        console.log(`[Backend] Fetching hash for block ${block} from Mempool...`);
        const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
        if (!resp.ok) return res.json({ resolved: false });
        hash = (await resp.text()).trim();
        blockHashCache[block] = hash; // Store forever
    }

    const winningNumber = Number((BigInt('0x' + hash) % 21n) + 1n);
    const winners = await queryNeon(`
        SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias
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
    if (tx && ((tx as any).settled || (tx as any).preimage)) {
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
    } catch (e: any) {
        console.error('[handlePool] Error:', e.message);
        res.json({ balance: 0 });
    } finally {
        client.close();
    }
};

export const handleVerifyIdentity = async (req: any, res: any) => {
    try {
        const { event } = req.body;
        if (!event) return res.status(400).json({ error: 'Missing event' });
        
        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        if (parsedEvent.kind !== 0) return res.status(400).json({ error: 'Invalid kind' });

        if (!verifyEvent(parsedEvent)) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const pubkey = parsedEvent.pubkey;
        const createdAt = parsedEvent.created_at;

        // 1. Insurance of Date: Check if this event is newer than the stored one
        const existing = await queryNeon('SELECT last_updated FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        if (existing[0] && existing[0].last_updated) {
            const lastUpdated = Math.floor(new Date(existing[0].last_updated).getTime() / 1000);
            if (createdAt <= lastUpdated) {
                return res.json({ ok: true, message: 'Existing identity is newer or same age' });
            }
        }

        const content = JSON.parse(parsedEvent.content);
        const alias = content.nip05 || content.name || content.display_name;
        
        if (alias) {
            // Update with last_updated to prevent old event replays
            await queryNeon(`
                INSERT INTO lotto_identities (pubkey, alias, last_updated) 
                VALUES ($1, $2, TO_TIMESTAMP($3)) 
                ON CONFLICT (pubkey) DO UPDATE SET 
                    alias = EXCLUDED.alias, 
                    last_updated = EXCLUDED.last_updated
            `, [pubkey, alias, createdAt]);
            return res.json({ ok: true, alias });
        }
        
        return res.json({ ok: true, message: 'No alias found' });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
};
