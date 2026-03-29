import { getPoolBalance } from './nwc';
import { processPayouts } from './champion-call';

export const cachedBlock = { height: 890000, target: 890021, poolBalance: 0 };
export const blockHashCache: Record<number, string> = {};

export async function syncData() {
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
    }
}