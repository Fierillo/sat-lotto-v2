import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { cachedBlock, syncData } from '@/lib/cache';
import { calculateResult } from '@/lib/payout-logic';

export async function GET() {
    await syncData();
    
    try {
        const targetBlock = cachedBlock.target;
        const currentHeight = cachedBlock.height;
        const lastResolvedBlock = Math.floor(currentHeight / 21) * 21;

        // 1. Fetch Active Bets
        const activeBets = await queryNeon(`
            SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias, b.created_at
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
            ORDER BY b.created_at DESC
        `, [targetBlock]);

        // 2. Fetch Hall of Fame (Champions)
        const championsQuery = `
            SELECT pubkey, alias, sats_earned 
            FROM lotto_identities 
            WHERE sats_earned > 0
            ORDER BY sats_earned DESC
            LIMIT 50
        `;
        
        let champions = [];
        try {
            champions = await queryNeon(championsQuery);
        } catch (e: any) {
            if (e.message?.includes('column "sats_earned" does not exist')) {
                await queryNeon('ALTER TABLE lotto_identities ADD COLUMN IF NOT EXISTS sats_earned INTEGER DEFAULT 0');
                champions = await queryNeon(championsQuery);
            } else throw e;
        }

        // 3. Fetch Last Result
        let lastResult = null;
        if (lastResolvedBlock > 0) {
            const result = await calculateResult(lastResolvedBlock);
            if (result) {
                const winners = await queryNeon(`
                    SELECT b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias
                    FROM lotto_bets b
                    LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
                    WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
                `, [lastResolvedBlock, result.winningNumber]);
                
                lastResult = {
                    resolved: true,
                    blockHash: result.hash,
                    winningNumber: result.winningNumber,
                    winners,
                    targetBlock: lastResolvedBlock
                };
            }
        }

        return NextResponse.json({
            block: cachedBlock,
            activeBets,
            champions,
            lastResult
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
