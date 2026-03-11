import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';

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
    } catch {
        return NextResponse.json({ alias: null, lastCelebrated: 0, sats_earned: 0 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const body = await request.json();
        const { alias, sats_earned } = body;

        await queryNeon(`
            INSERT INTO lotto_identities (pubkey, alias, sats_earned)
            VALUES ($1, $2, $3)
            ON CONFLICT (pubkey) DO UPDATE SET 
                alias = COALESCE(EXCLUDED.alias, lotto_identities.alias),
                sats_earned = COALESCE(EXCLUDED.sats_earned, lotto_identities.sats_earned)
        `, [pubkey, alias || null, sats_earned || 0]);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}