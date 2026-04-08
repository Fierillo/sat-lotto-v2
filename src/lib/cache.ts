import { getLottoState, syncLottoState } from './state';

export const cachedBlock = { height: 890000, target: 890021, poolBalance: 0 };
export const blockHashCache: Record<number, string> = {};

// This function is still used by components, but we'll proxy it to DB state
export async function syncData() {
    const state = await syncLottoState(false); // Throttled to 21s
    
    // Sync memory object for legacy code compatibility (if any)
    cachedBlock.height = state.current_block;
    cachedBlock.target = state.target_block;
    cachedBlock.poolBalance = state.pool_balance;

    return state;
}
