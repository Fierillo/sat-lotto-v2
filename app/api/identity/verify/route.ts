import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { verifyEvent } from 'nostr-tools';

const identityRateLimit: Record<string, number> = {};
setInterval(() => {
    for (const key in identityRateLimit) delete identityRateLimit[key];
}, 3600000);

export async function POST(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    identityRateLimit[ip] = (identityRateLimit[ip] || 0) + 1;
    if (identityRateLimit[ip] > 10) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    try {
        const body = await request.json();
        const { event, blockHeight, lud16 } = body;
        if (!event) return NextResponse.json({ error: 'Missing event' }, { status: 400 });
        
        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        if (parsedEvent.kind !== 0) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

        if (!verifyEvent(parsedEvent)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        const pubkey = parsedEvent.pubkey;
        const createdAt = parsedEvent.created_at;

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

        if (blockHeight) {
            await queryNeon(`
                UPDATE lotto_identities 
                SET last_celebrated_block = GREATEST(last_celebrated_block, $1)
                WHERE pubkey = $2
            `, [parseInt(blockHeight), pubkey]);
        }
        
        return NextResponse.json({ ok: true, alias });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}