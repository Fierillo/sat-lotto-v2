import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';

export async function GET() {
    try {
        const query = `
            SELECT pubkey, alias, sats_earned 
            FROM lotto_identities 
            WHERE sats_earned > 0
            ORDER BY sats_earned DESC
            LIMIT 50
        `;
        
        try {
            const winners = await queryNeon(query);
            return NextResponse.json({ winners });
        } catch (e: any) {
            // Lazy migration: if column missing, add it and retry once
            if (e.message?.includes('column "sats_earned" does not exist')) {
                console.log('[Migration] Adding missing column sats_earned to lotto_identities');
                await queryNeon('ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_earned INTEGER DEFAULT 0');
                const winners = await queryNeon(query);
                return NextResponse.json({ winners });
            }
            throw e;
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
