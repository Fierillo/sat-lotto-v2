import { NextResponse } from 'next/server';
import { queryNeon } from '@/src/lib/db';
import { syncLottoState } from '@/src/lib/state';
import { calculateResult } from '@/src/lib/champion-call';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';
import type { Champion } from '@/src/types/game';

export async function GET(request: Request) {
    const clientIP = await getClientIP(request);
    const rateCheck = await checkRateLimit('state:ip', clientIP);
    if (!rateCheck.allowed) {
        return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    
    // Sync state (throttled to 21s)
    const state = await syncLottoState(false);
    
    try {
        const targetBlock = state.target_block;
        const currentHeight = state.current_block;
        const lastResolvedBlock = Math.floor(currentHeight / 21) * 21;

        const activeBets = await queryNeon(`
            SELECT DISTINCT ON (b.pubkey) 
                b.pubkey, b.selected_number, COALESCE(i.nip05, b.nip05) as nip05, b.created_at, b.is_paid
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.betting_block >= ($1 - 21)
            ORDER BY b.pubkey, b.is_paid DESC, b.created_at DESC
        `, [targetBlock]);

        activeBets.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const publicBets = activeBets.filter((b: any) => b.is_paid);

        const championsRaw = await queryNeon(`
            SELECT pubkey, nip05, sats_earned, sats_pending, sats_earned + sats_pending as total_sats
            FROM lotto_identities 
            WHERE sats_earned > 0 OR sats_pending > 0
            ORDER BY (sats_earned + sats_pending) DESC
            LIMIT 50
        `);

        const champions: Champion[] = championsRaw.map((c: any) => ({
            pubkey: c.pubkey,
            nip05: c.nip05,
            sats_earned: c.sats_earned,
            sats_pending: c.sats_pending,
            total_sats: c.total_sats
        }));

        const pendingResult = await queryNeon(`
            SELECT COALESCE(SUM(sats_pending), 0) as total_pending
            FROM lotto_identities
            WHERE sats_pending > 0
        `);
        const totalPending = pendingResult[0]?.total_pending || 0;
        const displayedPoolBalance = Math.max(0, state.pool_balance - totalPending);

        let lastResult = null;
        if (lastResolvedBlock > 0) {
            const result = await calculateResult(lastResolvedBlock);
            if (result) {
                const winners = await queryNeon(`
                    SELECT b.pubkey, b.selected_number, COALESCE(i.nip05, b.nip05) as nip05
                    FROM lotto_bets b
                    LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
                    WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
                `, [lastResolvedBlock, result.winningNumber]);
                
                const blocksUntilCelebration = Math.max(0, (lastResolvedBlock + 2) - currentHeight);
                const hasConfirmed = blocksUntilCelebration === 0;

                lastResult = {
                    resolved: true,
                    blockHash: result.hash,
                    winningNumber: result.winningNumber,
                    winners,
                    targetBlock: lastResolvedBlock,
                    blocksUntilCelebration,
                    hasConfirmed
                };
            }
        }

        return NextResponse.json({
            block: { 
                height: currentHeight, 
                target: targetBlock, 
                poolBalance: displayedPoolBalance 
            },
            activeBets: publicBets,
            champions,
            lastResult
        });
    } catch (e: any) {
        console.error('[State GET] Error:', e.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
