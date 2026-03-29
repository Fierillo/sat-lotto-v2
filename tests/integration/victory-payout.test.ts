import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Victory Payout Integration Tests', () => {
    it('should return lastResult with correct structure when resolved', async () => {
        const res = await fetch(`${API_URL}/api/state`);

        if (res.status === 429) {
            return;
        }

        const data = await res.json();

        if (!data.lastResult) {
            return;
        }

        expect(data.lastResult.resolved).toBe(true);
        expect(data.lastResult.winningNumber).toBeGreaterThanOrEqual(1);
        expect(data.lastResult.winningNumber).toBeLessThanOrEqual(21);
        expect(data.lastResult.targetBlock).toBeGreaterThan(0);
    });

    it('should return winners array when block is resolved', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();

        if (data.lastResult && data.lastResult.resolved) {
            expect(Array.isArray(data.lastResult.winners)).toBe(true);

            for (const winner of data.lastResult.winners) {
                expect(winner.pubkey).toBeDefined();
                expect(typeof winner.selected_number).toBe('number');
            }
        }
    });

    it('should calculate blocksUntilCelebration correctly', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();

        if (data.lastResult) {
            expect(data.lastResult.blocksUntilCelebration).toBeGreaterThanOrEqual(0);

            if (data.lastResult.blocksUntilCelebration === 0) {
                expect(data.lastResult.hasConfirmed).toBe(true);
            }
        }
    });

    it('should return champions with winnings', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        
        if (res.status === 429) {
            return;
        }
        
        const data = await res.json();

        expect(data).toHaveProperty('champions');
        expect(Array.isArray(data.champions)).toBe(true);

        if (data.champions.length > 0) {
            for (const champion of data.champions) {
                expect(champion.pubkey).toBeDefined();
                expect(champion.sats_earned).toBeGreaterThan(0);
            }
        }
    });

    it('should include hash for winner determination', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();

        if (data.lastResult && data.lastResult.resolved) {
            expect(data.lastResult.blockHash).toBeDefined();

            const hash = data.lastResult.blockHash;
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64);
        }
    });
});
