import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;
    try {
        const rows = await queryNeon(`
            SELECT alias, last_celebrated_block 
            FROM lotto_identities WHERE pubkey = $1
            LIMIT 1
        `, [pubkey]);

        return NextResponse.json({ 
            alias: rows[0]?.alias || null,
            lastCelebrated: rows[0]?.last_celebrated_block || 0 
        });
    } catch {
        return NextResponse.json({ alias: null, lastCelebrated: 0 });
    }
}