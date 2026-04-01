import { NextResponse } from 'next/server';
import { queryNeon, dbGet } from '@/src/lib/db';
import { verifyEvent } from 'nostr-tools';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';
import type { IdentityApiResponse } from '@/src/types/identity';

export async function GET(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const identity = await dbGet<{ 
            nip05: string | null; 
            sats_earned: number; 
            sats_pending: number;
            lud16: string | null; 
            winner_block: number; 
            can_claim: boolean 
        }>('lotto_identities', { pubkey });

        const response: IdentityApiResponse = {
            pubkey,
            nip05: identity?.nip05 || null,
            sats_earned: identity?.sats_earned || 0,
            sats_pending: identity?.sats_pending || 0,
            lud16: identity?.lud16 || null,
            winner_block: identity?.winner_block || 0,
            can_claim: identity?.can_claim || false
        };

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('[Identity GET] Error:', e.message);
        return NextResponse.json({ 
            pubkey, 
            nip05: null, 
            sats_earned: 0, 
            sats_pending: 0, 
            lud16: null, 
            winner_block: 0, 
            can_claim: false 
        });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey: urlPubkey } = await params;

    try {
        const body = await request.json();
        const { event, lud16, nip05 } = body;

        const clientIP = await getClientIP(request);
        const rateCheck = await checkRateLimit('identity:ip', clientIP);
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        if (!event) {
            return NextResponse.json({ error: 'Signature required' }, { status: 401 });
        }

        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        if (parsedEvent.kind !== 0 || !verifyEvent(parsedEvent)) {
            return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
        }

        const pubkey = parsedEvent.pubkey;
        if (pubkey !== urlPubkey) {
            return NextResponse.json({ error: 'Pubkey mismatch' }, { status: 400 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parsedEvent.created_at) > 900) {
            return NextResponse.json({ error: 'Signature expired' }, { status: 400 });
        }

        const content = JSON.parse(parsedEvent.content);
        const profileNip05 = nip05 || content.nip05 || content.name || content.display_name;
        const profileLud16 = lud16 || content.lud16 || content.lud06;

        await queryNeon(`
            INSERT INTO lotto_identities (pubkey, nip05, lud16, last_updated)
            VALUES ($1, $2, $3, TO_TIMESTAMP($4))
            ON CONFLICT (pubkey) DO UPDATE SET
                nip05 = COALESCE($2, lotto_identities.nip05),
                lud16 = COALESCE($3, lotto_identities.lud16),
                last_updated = GREATEST(lotto_identities.last_updated, TO_TIMESTAMP($4))
        `, [pubkey, profileNip05, profileLud16, parsedEvent.created_at]);

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[Identity POST] Error:', err.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}