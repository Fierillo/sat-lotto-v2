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
    } catch (err: any) {
        console.error('[syncData] Error fetching block height:', err.message);
    }

    try {
        const bal = await getPoolBalance();
        if (bal !== cachedBlock.poolBalance) {
            cachedBlock.poolBalance = bal;
        }
    } catch (err: any) {
        console.error('[syncData] Error getting pool balance:', err.message);
    }

    try {
        const blocksUntilCelebration = (cachedBlock.target + 2) - cachedBlock.height;
        if (blocksUntilCelebration <= 0) {
            await processPayouts(cachedBlock.height);
        }
    } catch (err: any) {
        console.error('[syncData] Error processing payouts:', err.message);
    }
}