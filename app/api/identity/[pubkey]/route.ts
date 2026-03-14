import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { verifyEvent } from 'nostr-tools';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

export async function GET(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const rows = await queryNeon(`
            SELECT alias, last_celebrated_block, sats_earned 
            FROM lotto_identities WHERE pubkey = $1
            LIMIT 1
        `, [pubkey]);

        return NextResponse.json({ 
            alias: rows[0]?.alias || null,
            lastCelebrated: rows[0]?.last_celebrated_block || 0,
            sats_earned: rows[0]?.sats_earned || 0
        });
    } catch (e: any) {
        console.error('[Identity GET] Error:', e.message);
        return NextResponse.json({ alias: null, lastCelebrated: 0, sats_earned: 0 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey: urlPubkey } = await params;
    
    try {
        const body = await request.json();
        const { event, blockHeight, lud16 } = body;

        if (!event) {
            return NextResponse.json({ error: 'Signed event required' }, { status: 401 });
        }

        const clientIP = await getClientIP(request);
        const rateCheck = await checkRateLimit('identity:ip', clientIP);
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        if (parsedEvent.kind !== 0 || !verifyEvent(parsedEvent)) {
            return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
        }

        const pubkey = parsedEvent.pubkey;
        if (pubkey !== urlPubkey) return NextResponse.json({ error: 'Pubkey mismatch' }, { status: 400 });

        const content = JSON.parse(parsedEvent.content);
        const profileAlias = content.nip05 || content.name || content.display_name;
        const profileLud16 = lud16 || content.lud16 || content.lud06;
        
        await queryNeon(`
            INSERT INTO lotto_identities (pubkey, alias, last_updated, lud16) 
            VALUES ($1, $2, TO_TIMESTAMP($3), $4) 
            ON CONFLICT (pubkey) DO UPDATE SET 
                alias = COALESCE(EXCLUDED.alias, lotto_identities.alias), 
                lud16 = COALESCE(EXCLUDED.lud16, lotto_identities.lud16),
                last_updated = GREATEST(lotto_identities.last_updated, EXCLUDED.last_updated)
        `, [pubkey, profileAlias, parsedEvent.created_at, profileLud16]);

        if (blockHeight) {
            await queryNeon(`UPDATE lotto_identities SET last_celebrated_block = GREATEST(last_celebrated_block, $1) WHERE pubkey = $2`, [parseInt(blockHeight), pubkey]);
        }
        
        return NextResponse.json({ ok: true, alias: profileAlias });
    } catch (err: any) {
        console.error('[Identity POST] Error:', err.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
