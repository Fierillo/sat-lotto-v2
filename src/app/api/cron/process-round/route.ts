import { NextResponse } from 'next/server';
import { syncData } from '@/src/lib/cache';
import { calculateResult, getWinners, buildAnnouncement } from '@/src/lib/champion-call';
import { publishRoundResult } from '@/src/lib/nostr';
import { dbGetAll, queryNeon } from '@/src/lib/db';
import { getPoolBalance } from '@/src/lib/nwc';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.VERCEL_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await syncData();

        const { cachedBlock } = await import('@/src/lib/cache');
        const lastResolvedTarget = Math.floor(cachedBlock.height / 21) * 21;

        if (cachedBlock.height >= lastResolvedTarget + 2) {
            const alreadyAnnounced = await dbGetAll('lotto_payouts', { block_height: lastResolvedTarget, type: 'cycle_resolved' });

            if (alreadyAnnounced.length === 0) {
                const result = await calculateResult(lastResolvedTarget);
                if (result) {
                    const totalSats = await getPoolBalance();
                    const winners = await getWinners(lastResolvedTarget, result.winningNumber);

                    await publishRoundResult(buildAnnouncement(lastResolvedTarget, winners, totalSats));

                    await queryNeon(`
                        INSERT INTO lotto_payouts (pubkey, block_height, amount, type, status)
                        VALUES ('SYSTEM', $1, 0, 'cycle_resolved', 'paid')
                        ON CONFLICT DO NOTHING
                    `, [lastResolvedTarget]);

                    return NextResponse.json({ announced: true, block: lastResolvedTarget, winners: winners.length });
                }
            }

            return NextResponse.json({ announced: false, reason: 'already_announced' });
        }

        return NextResponse.json({ announced: false, reason: 'not_due_yet', blocksUntil: (lastResolvedTarget + 2) - cachedBlock.height });
    } catch (e: any) {
        console.error('[Cron] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
