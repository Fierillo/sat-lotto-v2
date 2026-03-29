import { NextResponse } from 'next/server';
import { queryNeon } from '../../../../lib/db';

interface Champion {
    pubkey: string;
    nip05: string;
    sats_earned: number;
}

export async function POST(request: Request) {
    if (process.env.NEXT_PUBLIC_TEST !== 'on') {
        return NextResponse.json(
            { error: "No sos hacker, sos un mamerto. Volvé a Google." },
            { status: 403 }
        );
    }

    try {
        const { champions, action }: { champions?: Champion[]; action: 'set' | 'reset' } = await request.json();

        if (action === 'reset') {
            const pubkeys = champions?.map(c => c.pubkey) || [];
            if (pubkeys.length === 0) {
                return NextResponse.json({ error: 'No pubkeys provided for reset' }, { status: 400 });
            }

            for (const pubkey of pubkeys) {
                await queryNeon(`
                    UPDATE lotto_identities SET sats_earned = 0 WHERE pubkey = $1
                `, [pubkey]);
            }

            return NextResponse.json({ success: true, action: 'reset' });
        }

        if (action === 'set') {
            if (!Array.isArray(champions)) {
                return NextResponse.json({ error: 'Invalid champions data' }, { status: 400 });
            }

            for (const c of champions) {
                await queryNeon(`
                    INSERT INTO lotto_identities (pubkey, nip05, sats_earned)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (pubkey) DO UPDATE SET
                        nip05 = EXCLUDED.nip05,
                        sats_earned = EXCLUDED.sats_earned
                `, [c.pubkey, c.nip05, c.sats_earned]);
            }

            return NextResponse.json({ success: true, action: 'set' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (e) {
        console.error('[DEBUG CHAMPIONS]', e);
        return NextResponse.json(
            { error: 'Failed to update champions' },
            { status: 500 }
        );
    }
}
