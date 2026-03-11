import { nwc } from '@getalby/sdk';
import NDK, { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { queryNeon } from './db';
import { nip04 } from 'nostr-tools';
import { blockHashCache } from './cache';

// Silence NIP-04 deprecation warning
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('NIP-04')) return;
    originalWarn.apply(console, args);
};

// Bot Identity
const botNdk = new NDK({
    explicitRelayUrls: ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
});
const botPrivkey = process.env.NOSTR_PRIVKEY;
const nostrEnabled = process.env.NOSTR_ENABLED === 'true';
if (botPrivkey) {
    botNdk.signer = new NDKPrivateKeySigner(botPrivkey);
}

// Connect dynamically only when needed if serverless, to avoid hangs
let ndkConnected = false;
async function ensureNdkConnected() {
    if (!ndkConnected && nostrEnabled) {
        try {
            await botNdk.connect(5000);
            ndkConnected = true;
        } catch {
            console.error('[BotNDK] Connection failed');
        }
    }
}

export const getPoolBalance = async (): Promise<number> => {
    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return 0;

    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const balanceData = await client.getBalance();
        return Math.floor(balanceData.balance / 1000);
    } catch (e: any) {
        console.error('[getPoolBalance] NWC timeout');
        throw new Error('NWC timeout');
    } finally {
        try { client.close(); } catch {}
    }
};

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
    } catch (e: any) {
        console.error(`[LNURL] Failed: ${address}`, e.message?.slice(0, 50));
        return null;
    }
}

async function sendDM(pubkey: string, message: string) {
    if (!nostrEnabled || !botPrivkey) {
        return;
    }
    try {
        await ensureNdkConnected();
        const dm = new NDKEvent(botNdk);
        dm.kind = 4;
        dm.tags = [['p', pubkey]];
        dm.content = await nip04.encrypt(botPrivkey, pubkey, message);
        await dm.publish();
    } catch (e: any) {
        console.error(`[DM] Failed: ${pubkey.slice(0, 8)}...`, e.message?.slice(0, 30));
    }
}

export const calculateResult = async (block: number) => {
    let hash = blockHashCache[block];
    if (!hash) {
        try {
            const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
            if (!resp.ok) return null;
            hash = (await resp.text()).trim();
            blockHashCache[block] = hash;
        } catch { return null; }
    }
    const winningNumber = Number((BigInt('0x' + hash) % BigInt(21)) + BigInt(1));
    return { hash, winningNumber };
};

export const processPayouts = async (currentHeight: number) => {
    const lastResolvedTarget = Math.floor(currentHeight / 21) * 21;
    
    if (currentHeight >= lastResolvedTarget + 2) {
        const feeProcessed = await queryNeon('SELECT count(*) FROM lotto_payouts WHERE block_height = $1 AND type = $2', [lastResolvedTarget, 'fee']);
        if (parseInt(feeProcessed[0].count) === 0) {
            await runFullPayoutCycle(lastResolvedTarget);
        }
    }

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

        if (feeAmount > 0) {
            const feeInvoice = await getInvoiceFromLNAddress('fierillo@lawalletilla.vercel.app', feeAmount);
            if (feeInvoice) {
                try {
                    await nwcClient.payInvoice({ invoice: feeInvoice });
                    await queryNeon('INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status) VALUES ($1, $2, $3, $4, $5)', 
                        ['ADMIN', targetBlock, feeAmount, 'fee', 'paid']);
                } catch (e: any) { console.error('[PayoutWorker] Fee failed:', e.message?.slice(0, 40)); }
            }
        }

        const winnerNames: string[] = [];
        for (const winner of winners) {
            const winnerName = winner.identity_alias || winner.alias || winner.pubkey.slice(0, 8);
            winnerNames.push(winnerName);

            let paid = false;
            let lud16 = winner.lud16;
            
            if (!lud16) {
                await ensureNdkConnected();
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
                    } catch (e: any) { console.error('[PayoutWorker] Winner payment failed:', e.message?.slice(0, 40)); }
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

        if (botNdk.signer) {
            const announcement = winners.length > 0 
                ? `¡Ronda ${targetBlock} confirmada! 🏆\n\nCampeones: ${winnerNames.join(', ')}\nPremio repartido: ${prizePerWinner} sats c/u.\n\nFelicidades a los ganadores. ¡La suerte está echada!\n\nJugá vos también en: ${process.env.APP_URL || 'https://satlotto.ar'}`
                : `¡Ronda ${targetBlock} confirmada!\n\nEsta vez el azar fue esquivo y no hubo ganadores. 🎲\n\nEl pozo de ${totalSats} sats se acumula para el próximo sorteo. ¡Aprovechá la oportunidad!\n\nParticipá en: ${process.env.APP_URL || 'https://satlotto.ar'}`;
            
            await ensureNdkConnected();
            const ev = new NDKEvent(botNdk);
            ev.kind = 1;
            ev.content = announcement;
            if (nostrEnabled) {
                await ev.publish().catch(e => console.error('[PayoutWorker] Announcement failed:', e.message?.slice(0, 30)));
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
                } catch (e: any) {
                    console.error('[PayoutWorker] Retry failed:', e.message?.slice(0, 40));
                }
            }
        }
    } finally {
        nwcClient.close();
    }
}