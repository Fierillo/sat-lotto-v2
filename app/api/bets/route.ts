import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const block = parseInt(searchParams.get('block') || '0', 10);
    
    if (!block) return NextResponse.json({ error: 'Missing block' }, { status: 400 });
    
    try {
        const bets = await queryNeon(`
            SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias, b.created_at
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
            ORDER BY b.created_at DESC
        `, [block]);
        return NextResponse.json({ bets });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}