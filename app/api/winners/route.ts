import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';

export async function GET() {
    try {
        const winners = await queryNeon(`
            SELECT pubkey, alias, sats_earned 
            FROM lotto_identities 
            WHERE sats_earned > 0
            ORDER BY sats_earned DESC
            LIMIT 50
        `);

        return NextResponse.json({ winners });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
