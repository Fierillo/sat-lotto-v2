import { NextResponse } from 'next/server';
import { syncData } from '@/src/lib/cache';

// Vercel Cron endpoint for payout processing
// Runs every 2 minutes independently of frontend traffic
// Configured in vercel.json

export async function GET(request: Request) {
    // Verify cron secret (Vercel injects this)
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        await syncData();
        return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
    } catch (e: any) {
        console.error('[Cron Payout] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
