import { NextResponse } from 'next/server';
import { queryNeon } from '@/src/lib/db';
import { verifyEvent } from 'nostr-tools';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';

export async function GET(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const rows = await queryNeon(`
            SELECT nip05, sats_earned, lud16, winner_block, has_confirmed
            FROM lotto_identities WHERE pubkey = $1
            LIMIT 1
        `, [pubkey]);

        return NextResponse.json({
            nip05: rows[0]?.nip05 || null,
            sats_earned: rows[0]?.sats_earned || 0,
            lud16: rows[0]?.lud16 || null,
            winner_block: rows[0]?.winner_block || 0,
            has_confirmed: rows[0]?.has_confirmed || false
        });
    } catch (e: any) {
        console.error('[Identity GET] Error:', e.message);
        return NextResponse.json({ nip05: null, sats_earned: 0, lud16: null, winner_block: 0, has_confirmed: false });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey: urlPubkey } = await params;

    try {
        const body = await request.json();
        const { event, lud16, winner_block, has_confirmed } = body;

        const clientIP = await getClientIP(request);
        const rateCheck = await checkRateLimit('identity:ip', clientIP);
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        if (event) {
            const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
            if (parsedEvent.kind !== 0 || !verifyEvent(parsedEvent)) {
                return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
            }

            const pubkey = parsedEvent.pubkey;
            if (pubkey !== urlPubkey) return NextResponse.json({ error: 'Pubkey mismatch' }, { status: 400 });

            const content = JSON.parse(parsedEvent.content);
            const profileNip05 = content.nip05 || content.name || content.display_name;
            const profileLud16 = lud16 || content.lud16 || content.lud06;

            await queryNeon(`
                INSERT INTO lotto_identities (pubkey, nip05, last_updated, lud16, winner_block, has_confirmed)
                VALUES ($1, $2, TO_TIMESTAMP($3), $4, $5, $6)
                ON CONFLICT (pubkey) DO UPDATE SET
                    nip05 = COALESCE(EXCLUDED.nip05, lotto_identities.nip05),
                    lud16 = COALESCE(EXCLUDED.lud16, lotto_identities.lud16),
                    winner_block = COALESCE(EXCLUDED.winner_block, lotto_identities.winner_block),
                    has_confirmed = COALESCE(EXCLUDED.has_confirmed, lotto_identities.has_confirmed),
                    last_updated = GREATEST(lotto_identities.last_updated, EXCLUDED.last_updated)
            `, [pubkey, profileNip05, parsedEvent.created_at, profileLud16, winner_block || 0, has_confirmed || false]);
        } else {
            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (lud16 !== undefined) {
                updates.push(`lud16 = COALESCE(EXCLUDED.lud16, lotto_identities.lud16)`);
            }
            if (winner_block !== undefined) {
                updates.push(`winner_block = $${paramIndex}`);
                values.push(winner_block);
                paramIndex++;
            }
            if (has_confirmed !== undefined) {
                updates.push(`has_confirmed = $${paramIndex}`);
                values.push(has_confirmed);
                paramIndex++;
            }

            if (updates.length > 0) {
                values.push(urlPubkey);
                await queryNeon(`
                    INSERT INTO lotto_identities (pubkey, lud16, winner_block, has_confirmed, last_updated)
                    VALUES ($${paramIndex}, $1, $2, $3, NOW())
                    ON CONFLICT (pubkey) DO UPDATE SET
                        ${updates.join(', ')}
                `, [lud16 || null, winner_block || 0, has_confirmed || false, ...values]);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[Identity POST] Error:', err.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}