import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { verifyEvent } from 'nostr-tools';

export async function GET(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const query = `
            SELECT alias, last_celebrated_block, sats_earned 
            FROM lotto_identities WHERE pubkey = $1
            LIMIT 1
        `;
        
        let rows;
        try {
            rows = await queryNeon(query, [pubkey]);
        } catch (e: any) {
            if (e.message?.includes('column "sats_earned" does not exist')) {
                await queryNeon('ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_earned INTEGER DEFAULT 0');
                rows = await queryNeon(query, [pubkey]);
            } else throw e;
        }

        return NextResponse.json({ 
            alias: rows[0]?.alias || null,
            lastCelebrated: rows[0]?.last_celebrated_block || 0,
            sats_earned: rows[0]?.sats_earned || 0
        });
    } catch {
        return NextResponse.json({ alias: null, lastCelebrated: 0, sats_earned: 0 });
    }
}

const identityRateLimit: Record<string, number> = {};
// No setInterval in serverless, but we can use this for local dev or just accept it's transient

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey: urlPubkey } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    try {
        const body = await request.json();
        const { event, blockHeight, lud16, alias, sats_earned } = body;

        // --- Action: NOSTR VERIFY (Kind 0) ---
        if (event) {
            identityRateLimit[ip] = (identityRateLimit[ip] || 0) + 1;
            if (identityRateLimit[ip] > 20) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

            const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
            if (parsedEvent.kind !== 0 || !verifyEvent(parsedEvent)) {
                return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
            }

            const pubkey = parsedEvent.pubkey;
            if (pubkey !== urlPubkey) return NextResponse.json({ error: 'Pubkey mismatch' }, { status: 400 });

            const content = JSON.parse(parsedEvent.content);
            const profileAlias = content.nip05 || content.name || content.display_name;
            const profileLud16 = lud16 || content.lud16 || content.lud06;
            
            const executeVerify = async () => {
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
            };

            try {
                await executeVerify();
            } catch (e: any) {
                if (e.message?.includes('column "sats_earned" does not exist')) {
                    await queryNeon('ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_earned INTEGER DEFAULT 0');
                    await executeVerify();
                } else throw e;
            }
            
            return NextResponse.json({ ok: true, alias: profileAlias });
        }

        // --- Action: MANUAL UPDATE ---
        const executeUpdate = async () => {
            await queryNeon(`
                INSERT INTO lotto_identities (pubkey, alias, sats_earned)
                VALUES ($1, $2, $3)
                ON CONFLICT (pubkey) DO UPDATE SET 
                    alias = COALESCE(EXCLUDED.alias, lotto_identities.alias),
                    sats_earned = COALESCE(EXCLUDED.sats_earned, lotto_identities.sats_earned)
            `, [urlPubkey, alias || null, sats_earned || 0]);
        };

        try {
            await executeUpdate();
        } catch (e: any) {
            if (e.message?.includes('column "sats_earned" does not exist')) {
                await queryNeon('ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_earned INTEGER DEFAULT 0');
                await executeUpdate();
            } else throw e;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
