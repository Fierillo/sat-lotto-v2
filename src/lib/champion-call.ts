import { nwc } from '@getalby/sdk';
import { queryNeon, dbGetAll, dbUpdate } from './db';
import { blockHashCache } from './cache';
import { getPoolBalance } from './nwc';
import { getInvoiceFromLNAddress } from './ln';
import { sendDM, publishRoundResult, ensureNdkConnected, botNdk } from './nostr';

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
        const alreadyProcessed = await dbGetAll<{ id: number }>('lotto_payouts', { block_height: lastResolvedTarget, type: 'cycle_resolved' });
        
        if (alreadyProcessed.length === 0) {
            await runFullPayoutCycle(lastResolvedTarget);
        }
    }

    await retryFailedPayouts();
};

async function runFullPayoutCycle(targetBlock: number) {
    console.log(`[ChampionCall] Resolving confirmed block ${targetBlock}...`);
    const result = await calculateResult(targetBlock);
    if (!result) return;

    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return;
    const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    
    try {
        const totalSats = await getPoolBalance();

        const winners = await queryNeon(`
            SELECT DISTINCT ON (b.pubkey) 
                b.pubkey, i.nip05, i.lud16
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
            ORDER BY b.pubkey, b.created_at DESC
        `, [targetBlock, result.winningNumber]);

        const prizePerWinner = winners.length > 0 ? Math.floor(totalSats / winners.length) : 0;

        const winnerNames: string[] = [];
        for (const winner of winners) {
            const winnerName = winner.nip05 || winner.pubkey.slice(0, 8);
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
                    } catch (e: any) { console.error('[ChampionCall] Winner payment failed:', e.message?.slice(0, 40)); }
                }
            }

            await queryNeon(`
                INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status) 
                VALUES ($1, $2, $3, $4, $5) 
                ON CONFLICT (pubkey, block_height, type) DO UPDATE SET status = EXCLUDED.status
            `, [winner.pubkey, targetBlock, prizePerWinner, 'winner', paid ? 'paid' : 'failed']);

            await dbUpdate('lotto_identities', { pubkey: winner.pubkey }, { winner_block: targetBlock, has_confirmed: paid });

            if (paid) {
                await queryNeon(`
                    INSERT INTO lotto_identities (pubkey, sats_earned) 
                    VALUES ($1, $2) 
                    ON CONFLICT (pubkey) DO UPDATE SET sats_earned = lotto_identities.sats_earned + EXCLUDED.sats_earned
                `, [winner.pubkey, prizePerWinner]);
            }

            if (!paid) {
                const appUrl = process.env.APP_URL || 'https://satlotto.vercel.app';
                await sendDM(winner.pubkey, `¡FELICITACIONES CAMPEÓN! 🏆\n\nEl azar estuvo de tu lado y ganaste ${prizePerWinner} sats en SatLotto (Bloque ${targetBlock}). 🎲\n\nNo pudimos pagarte automáticamente porque no tenés una Lightning Address configurada.\n\nEntrá a ${appUrl} para reclamar tu premio.\n\n---\n\nCONGRATULATIONS CHAMPION! 🏆\n\nLuck was on your side and you won ${prizePerWinner} sats in SatLotto (Block ${targetBlock}). 🎲\n\nWe couldn't pay you automatically because you don't have a Lightning Address configured.\n\nVisit ${appUrl} to claim your prize.`);
            }
        }

        await queryNeon(`
            INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status)
            VALUES ('SYSTEM', $1, 0, 'cycle_resolved', 'paid')
            ON CONFLICT DO NOTHING
        `, [targetBlock]);

        const announcement = winners.length > 0 
            ? `¡Ronda ${targetBlock} confirmada! 🏆\n\nCampeones: ${winnerNames.join(', ')}\nPremio repartido: ${prizePerWinner} sats c/u.\n\nFelicidades a los ganadores. ¡La suerte está echada!\n\nJugá vos también en: ${process.env.APP_URL || 'https://satlotto.ar'}`
            : `¡Ronda ${targetBlock} confirmada!\n\nEsta vez el azar fue esquivo y no hubo ganadores. 🎲\n\nEl pozo de ${totalSats} sats se acumula para el próximo sorteo. ¡Aprovechá la oportunidad!\n\nParticipá en: ${process.env.APP_URL || 'https://satlotto.ar'}`;
        
        await publishRoundResult(announcement);
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
            console.log(`[ChampionCall] Retrying payout for ${p.pubkey} (Block ${p.block_height})...`);
            const invoice = await getInvoiceFromLNAddress(p.lud16, p.amount);
            if (invoice) {
                try {
                    await nwcClient.payInvoice({ invoice });
                    await dbUpdate('lotto_payouts', { pubkey: p.pubkey, block_height: p.block_height, type: 'winner' }, { status: 'paid' });
                    
                    await queryNeon(`
                        UPDATE lotto_identities SET sats_earned = sats_earned + $1 WHERE pubkey = $2
                    `, [p.amount, p.pubkey]);

                    await sendDM(p.pubkey, `¡Listo! 🇦🇷 Ya te envié tus ${p.amount} sats del bloque ${p.block_height} a ${p.lud16}. ¡Gracias por jugar! ⚡\n\nDone! I've sent your ${p.amount} sats from block ${p.block_height} to ${p.lud16}. Thanks for playing! ⚡`);
                } catch (e: any) {
                    console.error('[ChampionCall] Retry failed:', e.message?.slice(0, 40));
                }
            }
        }
    } finally {
        nwcClient.close();
    }
}
