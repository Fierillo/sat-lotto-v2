import { NextResponse } from 'next/server';
import { syncLottoState } from '@/src/lib/state';
import { calculateResult, getWinners, buildAnnouncement } from '@/src/lib/champion-call';
import { publishRoundResult } from '@/src/lib/nostr';
import { dbGet, dbInsert } from '@/src/lib/db';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.VERCEL_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Force sync state (mempool + NWC)
        const state = await syncLottoState(true);
        const lastResolvedTarget = Math.floor(state.current_block / 21) * 21;

        if (state.current_block >= lastResolvedTarget + 2) {
            // Check if already announced
            const alreadyAnnounced = await dbGet('lotto_payouts', { 
                block_height: lastResolvedTarget, 
                type: 'cycle_announced' 
            });

            if (!alreadyAnnounced) {
                const result = await calculateResult(lastResolvedTarget);
                if (result) {
                    const winners = await getWinners(lastResolvedTarget, result.winningNumber);
                    
                    // Publish to Nostr
                    await publishRoundResult(buildAnnouncement(lastResolvedTarget, winners, state.pool_balance));

                    // Mark as announced
                    await dbInsert('lotto_payouts', {
                        pubkey: 'SYSTEM',
                        block_height: lastResolvedTarget,
                        amount: 0,
                        type: 'cycle_announced',
                        status: 'paid'
                    });

                    return NextResponse.json({ announced: true, block: lastResolvedTarget, winners: winners.length });
                }
            }

            return NextResponse.json({ announced: false, reason: 'already_announced' });
        }

        return NextResponse.json({ 
            announced: false, 
            reason: 'not_due_yet', 
            blocksUntil: (lastResolvedTarget + 2) - state.current_block 
        });
    } catch (e: any) {
        console.error('[Cron] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
