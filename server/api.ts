import { queryNeon } from './db.ts';
import { verifyEvent, nip04 } from 'nostr-tools';
import { createNwcInvoice } from '../src/utils/create-invoice.ts';
import { lookupNwcInvoice } from '../src/utils/pay-invoice.ts';
import { nwc } from '@getalby/sdk';
import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';

const blockHashCache: Record<number, string> = {};

// Bot Identity
const botNdk = new NDK({
    explicitRelayUrls: ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
});
const botPrivkey = process.env.NOSTR_PRIVKEY;
const nostrEnabled = process.env.NOSTR_ENABLED === 'true';
if (botPrivkey) {
    botNdk.signer = new NDKPrivateKeySigner(botPrivkey);
}
botNdk.connect().catch(() => console.error('[BotNDK] Connection failed'));

async function getInvoiceFromLNAddress(address: string, amountSats: number): Promise<string | null> {
    try {
        const [user, domain] = address.split('@');
        const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
        const lnurlData = await lnurlRes.json();
        const callback = lnurlData.callback;
        const amountMsats = amountSats * 1000;
        const invRes = await fetch(`${callback}?amount=${amountMsats}`);
        const invData = await invRes.json();
        return invData.pr || invData.payment_request;
    } catch (e) {
        console.error(`[LNURL] Failed to get invoice for ${address}:`, e);
        return null;
    }
}

async function sendDM(pubkey: string, message: string) {
    if (!nostrEnabled || !botPrivkey) {
        console.log(`[DM] Disabled. Would send to ${pubkey}: ${message.slice(0, 50)}...`);
        return;
    }
    try {
        const dm = new NDKEvent(botNdk);
        dm.kind = 4;
        dm.tags = [['p', pubkey]];
        
        // Use explicit NIP-04 for compatibility with Primal/Amethyst
        dm.content = await nip04.encrypt(botPrivkey, pubkey, message);
        await dm.publish();
    } catch (e) {
        console.error(`[DM] Failed to send to ${pubkey}:`, e);
    }
}

export async function startBotListener() {
    // Listener is intentionally disabled to avoid WebSocket timeouts
    // and because we don't expect replies to the bot DMs anymore.
    console.log('[Bot] Listener disabled. Bot will only broadcast messages.');
}

export const handleBet = async (req: any, res: any, cachedBlock: any) => {
// ...
// ... existing handleBet ...
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

        // 2. Validate Number Range (Anti-Invalid Numbers)
        if (isNaN(finalNumero) || finalNumero < 1 || finalNumero > 21) {
            return res.status(400).json({ error: 'Invalid number. Must be between 1 and 21.' });
        }

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
        
        // Fase Frozen: Bloqueamos apuestas en los bloques 19, 20 y 21 del ciclo (height >= target - 2)
        const isFrozen = (realTimeHeight || cachedBlock.height) >= finalBloque - 2;
        if (isFrozen) {
            return res.status(403).json({ error: 'Betting is closed for this block (Fase Frozen)' });
        }

        // 4. Rate Limit (DDoS Protection) - basic per-pubkey unpaid limit
        const existingBet = await queryNeon('SELECT is_paid, selected_number FROM lotto_bets WHERE pubkey = $1 AND target_block = $2', [finalPubkey, finalBloque]);
        
        if (existingBet[0]?.is_paid) {
            // If the number is the same, just return the existing success (idempotency)
            if (existingBet[0].selected_number === finalNumero) {
                return res.json({ message: 'You already have a paid bet for this number. Good luck!' });
            }
            // If the number is different, we allow a new bet (modal in frontend handles payment warning)
            // But we MUST NOT reset is_paid to false in the INSERT below if we don't handle it carefully.
        }

        const unpaidCount = await queryNeon(`
            SELECT count(*) FROM lotto_bets 
            WHERE pubkey = $1 AND is_paid = FALSE 
            AND created_at > NOW() - INTERVAL '10 minutes'
        `, [finalPubkey]);
        
        if (parseInt(unpaidCount[0].count) > 5) {
            return res.status(429).json({ error: 'Too many unpaid invoices. Please wait 10 minutes or pay your bets.' });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return res.status(500).json({ error: 'Server NWC_URL not configured in .env' });

        let invoice: any;
        try {
            console.log(`[NWC] Creating invoice for 21 sats... Block: ${finalBloque}, Num: ${finalNumero}`);
            invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`);
            // Sanitize log: only show safe fields for debugging
            console.log('[NWC] Response received:', JSON.stringify({
                payment_request: invoice.payment_request || invoice.paymentRequest,
                payment_hash: invoice.payment_hash || invoice.paymentHash
            }));
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
                is_paid = CASE 
                    WHEN lotto_bets.selected_number = EXCLUDED.selected_number THEN lotto_bets.is_paid 
                    ELSE FALSE 
                END,
                selected_number = EXCLUDED.selected_number, 
                payment_request = EXCLUDED.payment_request,
                payment_hash = EXCLUDED.payment_hash,
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
    if (!block) return res.status(400).json({ error: 'Missing block' });
    
    const result = await calculateResult(block);
    if (!result) return res.json({ resolved: false });

    const winners = await queryNeon(`
        SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias
        FROM lotto_bets b
        LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
        WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
    `, [block, result.winningNumber]);
    
    res.json({ resolved: true, blockHash: result.hash, winningNumber: result.winningNumber, winners, targetBlock: block });
};

const calculateResult = async (block: number) => {
    let hash = blockHashCache[block];
    if (!hash) {
        try {
            const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
            if (!resp.ok) return null;
            hash = (await resp.text()).trim();
            blockHashCache[block] = hash;
        } catch { return null; }
    }
    const winningNumber = Number((BigInt('0x' + hash) % 21n) + 1n);
    return { hash, winningNumber };
};

export const processPayouts = async (currentHeight: number) => {
    const lastResolvedTarget = Math.floor(currentHeight / 21) * 21;
    
    // 1. Detección de nueva ronda confirmada (2 confirmaciones)
    if (currentHeight >= lastResolvedTarget + 2) {
        const feeProcessed = await queryNeon('SELECT count(*) FROM lotto_payouts WHERE block_height = $1 AND type = $2', [lastResolvedTarget, 'fee']);
        if (parseInt(feeProcessed[0].count) === 0) {
            await runFullPayoutCycle(lastResolvedTarget);
        }
    }

    // 2. Reintento de pagos fallidos (Cualquier bloque anterior)
    await retryFailedPayouts();
};

async function runFullPayoutCycle(targetBlock: number) {
    console.log(`[PayoutWorker] Resolving confirmed block ${targetBlock}...`);
    const result = await calculateResult(targetBlock);
    if (!result) return;

    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return;
    const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    
    try {
        const balanceData = await nwcClient.getBalance();
        const totalSats = Math.floor(balanceData.balance / 1000);

        const winners = await queryNeon(`
            SELECT b.pubkey, b.alias, i.alias as identity_alias, i.lud16
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
        `, [targetBlock, result.winningNumber]);

        const feeAmount = Math.floor(totalSats * 0.042);
        const netPool = totalSats - feeAmount;
        const prizePerWinner = winners.length > 0 ? Math.floor(netPool / winners.length) : 0;

        // --- PAGO DE COMISIÓN ---
        if (feeAmount > 0) {
            const feeInvoice = await getInvoiceFromLNAddress('fierillo@lawalletilla.vercel.app', feeAmount);
            if (feeInvoice) {
                try {
                    await nwcClient.payInvoice({ invoice: feeInvoice });
                    await queryNeon('INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status) VALUES ($1, $2, $3, $4, $5)', 
                        ['ADMIN', targetBlock, feeAmount, 'fee', 'paid']);
                } catch (e) { console.error('[PayoutWorker] Fee payment failed', e); }
            }
        }

        // --- PAGO A GANADORES ---
        const winnerNames: string[] = [];
        for (const winner of winners) {
            const winnerName = winner.identity_alias || winner.alias || winner.pubkey.slice(0, 8);
            winnerNames.push(winnerName);

            let paid = false;
            let lud16 = winner.lud16;
            
            if (!lud16) {
                const user = botNdk.getUser({ pubkey: winner.pubkey });
                const profile = await user.fetchProfile();
                lud16 = profile?.lud16 || profile?.lud06;
            }

            if (lud16) {
                const winnerInvoice = await getInvoiceFromLNAddress(lud16, prizePerWinner);
                if (winnerInvoice) {
                    try {
                        await nwcClient.payInvoice({ invoice: winnerInvoice });
                        paid = true;
                    } catch (e) { console.error(`[PayoutWorker] Payment execution failed for ${winner.pubkey}`, e); }
                }
            }

            await queryNeon(`
                INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status) 
                VALUES ($1, $2, $3, $4, $5) 
                ON CONFLICT (pubkey, block_height, type) DO UPDATE SET status = EXCLUDED.status
            `, [winner.pubkey, targetBlock, prizePerWinner, 'winner', paid ? 'paid' : 'failed']);

            if (!paid) {
                const appUrl = process.env.APP_URL || 'https://satlotto.vercel.app';
                await sendDM(winner.pubkey, `¡FELICITACIONES CAMPEÓN! 🏆\n\nEl azar estuvo de tu lado y ganaste ${prizePerWinner} sats en SatLotto (Bloque ${targetBlock}). 🎲\n\nNo pudimos pagarte automáticamente porque no tenés una Lightning Address configurada.\n\nEntrá a ${appUrl} para reclamar tu premio.\n\n---\n\nCONGRATULATIONS CHAMPION! 🏆\n\nLuck was on your side and you won ${prizePerWinner} sats in SatLotto (Block ${targetBlock}). 🎲\n\nWe couldn't pay you automatically because you don't have a Lightning Address configured.\n\nVisit ${appUrl} to claim your prize.`);
            }
        }

        // --- ANUNCIO PÚBLICO ---
        if (botNdk.signer) {
            const announcement = winners.length > 0 
                ? `¡Ronda ${targetBlock} confirmada! 🏆\n\nCampeones: ${winnerNames.join(', ')}\nPremio repartido: ${prizePerWinner} sats c/u.\n\nFelicidades a los ganadores. ¡La suerte está echada!\n\nJugá vos también en: ${process.env.APP_URL || 'https://satlotto.ar'}`
                : `¡Ronda ${targetBlock} confirmada!\n\nEsta vez el azar fue esquivo y no hubo ganadores. 🎲\n\nEl pozo de ${totalSats} sats se acumula para el próximo sorteo. ¡Aprovechá la oportunidad!\n\nParticipá en: ${process.env.APP_URL || 'https://satlotto.ar'}`;
            
            const ev = new NDKEvent(botNdk);
            ev.kind = 1;
            ev.content = announcement;
            if (nostrEnabled) {
                await ev.publish().catch(e => console.error('[PayoutWorker] Announcement failed', e));
            } else {
                console.log(`[PayoutWorker] Announcement disabled: ${announcement.slice(0, 50)}...`);
            }
        }
    } finally {
        try { nwcClient.close(); } catch {}
    }
}

async function retryFailedPayouts() {
    const failedOnes = await queryNeon(`
        SELECT p.pubkey, p.block_height, p.amount, i.lud16 
        FROM lotto_payouts p
        JOIN lotto_identities i ON p.pubkey = i.pubkey
        WHERE p.status = 'failed' AND p.type = 'winner' AND i.lud16 IS NOT NULL
    `);

    if (failedOnes.length === 0) return;

    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return;
    const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });

    try {
        for (const p of failedOnes) {
            console.log(`[PayoutWorker] Retrying payout for ${p.pubkey} (Block ${p.block_height})...`);
            const invoice = await getInvoiceFromLNAddress(p.lud16, p.amount);
            if (invoice) {
                try {
                    await nwcClient.payInvoice({ invoice });
                    await queryNeon('UPDATE lotto_payouts SET status = $1 WHERE pubkey = $2 AND block_height = $3 AND type = $4', 
                        ['paid', p.pubkey, p.block_height, 'winner']);
                    await sendDM(p.pubkey, `¡Listo! 🇦🇷 Ya te envié tus ${p.amount} sats del bloque ${p.block_height} a ${p.lud16}. ¡Gracias por jugar! ⚡\n\nDone! I've sent your ${p.amount} sats from block ${p.block_height} to ${p.lud16}. Thanks for playing! ⚡`);
                } catch (e) {
                    console.error(`[PayoutWorker] Retry failed for ${p.pubkey}:`, e);
                }
            }
        }
    } finally {
        nwcClient.close();
    }
}

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

export const getPoolBalance = async (): Promise<number> => {
    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return 0;

    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const balanceData = await client.getBalance();
        return Math.floor(balanceData.balance / 1000);
    } catch (e: any) {
        console.error('[getPoolBalance] Error:', e.message);
        throw e; // Lanzar error para no pisar con 0
    } finally {
        try { client.close(); } catch {}
    }
};

export const handleVerifyIdentity = async (req: any, res: any) => {
    try {
        const { event, blockHeight, lud16 } = req.body;
        if (!event) return res.status(400).json({ error: 'Missing event' });
        
        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        if (parsedEvent.kind !== 0) return res.status(400).json({ error: 'Invalid kind' });

        if (!verifyEvent(parsedEvent)) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const pubkey = parsedEvent.pubkey;
        const createdAt = parsedEvent.created_at;

        // 1. Update Identity / Alias / LUD16
        const content = JSON.parse(parsedEvent.content);
        const alias = content.nip05 || content.name || content.display_name;
        const profileLud16 = lud16 || content.lud16 || content.lud06;
        
        if (alias || profileLud16) {
            await queryNeon(`
                INSERT INTO lotto_identities (pubkey, alias, last_updated, lud16) 
                VALUES ($1, $2, TO_TIMESTAMP($3), $4) 
                ON CONFLICT (pubkey) DO UPDATE SET 
                    alias = COALESCE(EXCLUDED.alias, lotto_identities.alias), 
                    lud16 = COALESCE(EXCLUDED.lud16, lotto_identities.lud16),
                    last_updated = GREATEST(lotto_identities.last_updated, EXCLUDED.last_updated)
            `, [pubkey, alias, createdAt, profileLud16]);
        }

        // 2. Update Celebration Record (if provided)
        if (blockHeight) {
            await queryNeon(`
                UPDATE lotto_identities 
                SET last_celebrated_block = GREATEST(last_celebrated_block, $1)
                WHERE pubkey = $2
            `, [parseInt(blockHeight), pubkey]);
        }
        
        return res.json({ ok: true, alias });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
};

// Eliminar handleCelebrate ya que unificamos en verify
