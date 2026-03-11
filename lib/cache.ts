import { getPoolBalance, processPayouts } from './payout-logic';

export const cachedBlock = { height: 890000, target: 890021, poolBalance: 0 };
export const blockHashCache: Record<number, string> = {};

export async function syncData() {
    try {
        const resp = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = parseInt(await resp.text(), 10);
        if (height > 0) {
            cachedBlock.height = height;
            cachedBlock.target = (Math.floor(height / 21) + 1) * 21;
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
        await processPayouts(cachedBlock.height);
    } catch (e) {
        console.error('[PayoutWorker] Error:', e);
    }
}
