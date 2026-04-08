import { queryNeon, dbGet, dbUpdate, dbInsert } from './db';
import { getPoolBalance } from './nwc';
import { calculateResult, getWinners } from './champion-call';

export interface LottoState {
    current_block: number;
    target_block: number;
    pool_balance: number;
    last_resolved_block: number;
    updated_at: Date;
}

export async function getLottoState(): Promise<LottoState> {
    const state = await dbGet<LottoState & { id: number }>('lotto_state', { id: 1 });
    if (!state) {
        // Fallback to defaults if DB is not initialized
        return {
            current_block: 890000,
            target_block: 890021,
            pool_balance: 0,
            last_resolved_block: 0,
            updated_at: new Date(0)
        };
    }
    return state;
}

export async function syncLottoState(force: boolean = false): Promise<LottoState> {
    const currentState = await getLottoState();
    const now = new Date();
    
    // Throttle: Only sync if forced or 21s passed
    if (!force && now.getTime() - new Date(currentState.updated_at).getTime() < 21000) {
        return currentState;
    }

    console.log(`[Sync] Triggering state sync (force: ${force})...`);

    let newHeight = currentState.current_block;
    let newBalance = currentState.pool_balance;

    // 1. Fetch block height from mempool.space
    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            newHeight = height;
        }
    } catch (err: any) {
        console.error('[Sync] Block height fetch failed:', err.message);
    }

    // 2. Fetch balance from NWC
    try {
        const bal = await getPoolBalance();
        newBalance = bal;
    } catch (err: any) {
        console.error('[Sync] Pool balance fetch failed:', err.message);
    }

    const newTarget = Math.ceil(newHeight / 21) * 21;
    
    // 3. Update DB state
    await dbUpdate('lotto_state', { id: 1 }, {
        current_block: newHeight,
        target_block: newTarget,
        pool_balance: newBalance,
        updated_at: now
    });

    const updatedState = {
        ...currentState,
        current_block: newHeight,
        target_block: newTarget,
        pool_balance: newBalance,
        updated_at: now
    };

    // 4. Check for round resolution (winner detection)
    const lastResolvedTarget = Math.floor(newHeight / 21) * 21;
    if (newHeight >= lastResolvedTarget + 2 && updatedState.last_resolved_block < lastResolvedTarget) {
        await resolveRound(lastResolvedTarget);
    }

    return updatedState;
}

async function resolveRound(targetBlock: number) {
    console.log(`[Sync] Resolving winners for block ${targetBlock}...`);
    
    // Verify if already resolved in lotto_payouts
    const alreadyResolved = await queryNeon(
        "SELECT 1 FROM lotto_payouts WHERE block_height = $1 AND type = 'cycle_resolved' LIMIT 1",
        [targetBlock]
    );
    if (alreadyResolved.length > 0) {
        await dbUpdate('lotto_state', { id: 1 }, { last_resolved_block: targetBlock });
        return;
    }

    const result = await calculateResult(targetBlock);
    if (!result) return;

    const currentState = await getLottoState();
    const winners = await getWinners(targetBlock, result.winningNumber);
    const prizePerWinner = winners.length > 0 ? Math.floor(currentState.pool_balance / winners.length) : 0;

    for (const winner of winners) {
        // Record pending payout
        await dbInsert('lotto_payouts', {
            pubkey: winner.pubkey,
            block_height: targetBlock,
            amount: prizePerWinner,
            type: 'winner',
            status: 'pending' // Only manual claim pays
        });

        // Update identity for winner
        await queryNeon(`
            UPDATE lotto_identities
            SET winner_block = $1,
                can_claim = TRUE,
                sats_pending = sats_pending + $2
            WHERE pubkey = $3
        `, [targetBlock, prizePerWinner, winner.pubkey]);
    }

    // Mark as resolved
    await dbInsert('lotto_payouts', {
        pubkey: 'SYSTEM',
        block_height: targetBlock,
        amount: 0,
        type: 'cycle_resolved',
        status: 'paid'
    });

    await dbUpdate('lotto_state', { id: 1 }, { last_resolved_block: targetBlock });
    console.log(`[Sync] Round ${targetBlock} resolved with ${winners.length} winners.`);
}
