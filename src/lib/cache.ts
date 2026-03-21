import { getPoolBalance, processPayouts } from './payout-logic';

export const cachedBlock = { height: 890000, target: 890021, poolBalance: 0 };
export const blockHashCache: Record<number, string> = {};

let lastSyncTime = 0;
let isSyncing = false;

export async function syncData() {
    const now = Date.now();
    // Only sync once every 30 seconds to avoid API spam and console noise
    if (now - lastSyncTime < 30000 || isSyncing) return;
    
    isSyncing = true;
    lastSyncTime = now;

    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            cachedBlock.height = height;
            cachedBlock.target = Math.ceil(height / 21) * 21;
        }
    } catch (e) {
        console.error('[Sync] Block height fetch failed');
    }

    try {
        const bal = await getPoolBalance();
        if (bal !== cachedBlock.poolBalance) {
            console.log(`[Sync] Pool balance updated: ${bal} sats`);
            cachedBlock.poolBalance = bal;
        }
    } catch (e) {
        console.error('[Sync] Pool balance fetch failed (keeping last known balance)');
    }

    try {
        const blocksUntilCelebration = (cachedBlock.target + 2) - cachedBlock.height;
        if (blocksUntilCelebration <= 0) {
            await processPayouts(cachedBlock.height);
        } else {
            console.log(`[Sync] Waiting for ${blocksUntilCelebration} blocks before celebrating/paying`);
        }
    } catch (e: any) {
        console.error('[PayoutWorker] Error:', e.message || 'unknown');
    } finally {
        isSyncing = false;
    }
}
