import { NextResponse } from 'next/server';
import { syncData } from '@/src/lib/cache';
import { processPayouts } from '@/src/lib/champion-call';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.VERCEL_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await syncData();

        const { cachedBlock } = await import('@/src/lib/cache');
        const blocksUntil = (cachedBlock.target + 2) - cachedBlock.height;

        if (blocksUntil <= 0) {
            await processPayouts(cachedBlock.target);
            return NextResponse.json({ processed: true, block: cachedBlock.target });
        }

        return NextResponse.json({ processed: false, reason: 'not_due_yet', blocksUntil });
    } catch (e: any) {
        console.error('[Cron] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
