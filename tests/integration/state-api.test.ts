import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('State API Integration Tests', () => {
    it('should return valid game state', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        
        if (res.status === 429) {
            console.log('Rate limited, test skipped');
            return;
        }
        
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.block).toBeDefined();
        expect(data.block.height).toBeGreaterThan(0);
        expect(data.block.target).toBeGreaterThan(0);
        expect(data.block.poolBalance).toBeGreaterThanOrEqual(0);

        expect(Array.isArray(data.activeBets)).toBe(true);
        expect(Array.isArray(data.champions)).toBe(true);
    });

    it('should return correct block structure', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        
        if (res.status === 429) {
            return;
        }
        
        const data = await res.json();

        expect(data.block).toBeDefined();
        expect(typeof data.block.height).toBe('number');
        expect(typeof data.block.target).toBe('number');
        expect(data.block.target).toBeGreaterThan(data.block.height);
    });

    it('should have proper block math (target is multiple of 21)', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        
        if (res.status === 429) {
            return;
        }

        const data = await res.json();
        expect(data.block).toBeDefined();
        expect(data.block.target % 21).toBe(0);
    });
});
