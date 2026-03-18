import { NextResponse } from 'next/server';
import { queryNeon } from '@/src/lib/db';
import { cachedBlock, syncData } from '@/src/lib/cache';
import { calculateResult } from '@/src/lib/payout-logic';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';

export async function GET(request: Request) {
    const clientIP = await getClientIP(request);
    const rateCheck = await checkRateLimit('state:ip', clientIP);
    if (!rateCheck.allowed) {
        return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
    }
    
    await syncData();
    
    try {
        const targetBlock = cachedBlock.target;
        const currentHeight = cachedBlock.height;
        const lastResolvedBlock = Math.floor(currentHeight / 21) * 21;

        // 1. Fetch Active Bets (One per user, priority: Paid > Recent)
        const activeBets = await queryNeon(`
            SELECT DISTINCT ON (b.pubkey) 
                b.pubkey, b.selected_number, COALESCE(i.alias, b.alias) as alias, b.created_at, b.is_paid
            FROM lotto_bets b
            LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
            WHERE b.target_block = $1 AND b.betting_block >= ($1 - 21)
            ORDER BY b.pubkey, b.is_paid DESC, b.created_at DESC
        `, [targetBlock]);

        // Re-sort for the UI (recent first)
        activeBets.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Filter only paid bets for the main list shown to others, 
        // but we'll send all so the UI can filter or show "pending" if we wanted.
        // Actually, let's keep it consistent: only show paid bets in the public list.
        const publicBets = activeBets.filter((b: any) => b.is_paid);

        // 2. Fetch Hall of Fame (Champions)
        const champions = await queryNeon(`
            SELECT pubkey, alias, sats_earned 
            FROM lotto_identities 
            WHERE sats_earned > 0
            ORDER BY sats_earned DESC
            LIMIT 50
        `);

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
            activeBets: publicBets,
            champions,
            lastResult
        });
    } catch (e: any) {
        console.error('[State GET] Error:', e.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
