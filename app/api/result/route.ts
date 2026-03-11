import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { calculateResult } from '@/lib/payout-logic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const block = parseInt(searchParams.get('block') || '0', 10);
    if (!block) return NextResponse.json({ error: 'Missing block' }, { status: 400 });
    
    try {
        const result = await calculateResult(block);
        if (!result) return NextResponse.json({ resolved: false });

        const winners = await queryNeon(`
            SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
        `, [block, result.winningNumber]);
        
        return NextResponse.json({ 
            resolved: true, 
            blockHash: result.hash, 
            winningNumber: result.winningNumber, 
            winners, 
            targetBlock: block 
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}