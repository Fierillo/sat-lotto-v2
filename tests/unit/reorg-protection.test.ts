import { describe, it, expect } from 'vitest';

describe('2-Block Reorg Protection Logic', () => {
    function shouldProcessPayouts(currentHeight: number, targetBlock: number): boolean {
        const lastResolvedTarget = Math.floor(targetBlock / 21) * 21;
        return currentHeight >= lastResolvedTarget + 2;
    }

    it('should NOT process payouts before 2 blocks confirm', () => {
        const targetBlock = 840000;
        const currentHeight = 840001;
        expect(shouldProcessPayouts(currentHeight, targetBlock)).toBe(false);
    });

    it('should NOT process payouts at exactly 1 block confirm', () => {
        const targetBlock = 840000;
        const currentHeight = 840001;
        expect(shouldProcessPayouts(currentHeight, targetBlock)).toBe(false);
    });

    it('should process payouts at exactly 2 blocks confirm', () => {
        const targetBlock = 840000;
        const currentHeight = 840002;
        expect(shouldProcessPayouts(currentHeight, targetBlock)).toBe(true);
    });

    it('should process payouts after 2+ blocks confirm', () => {
        const targetBlock = 840000;
        const currentHeight = 840010;
        expect(shouldProcessPayouts(currentHeight, targetBlock)).toBe(true);
    });

    it('should handle block 21 boundary correctly', () => {
        expect(shouldProcessPayouts(23, 21)).toBe(true);
        expect(shouldProcessPayouts(22, 21)).toBe(false);
        expect(shouldProcessPayouts(21, 21)).toBe(false);
    });

    it('should handle block 42 boundary correctly', () => {
        expect(shouldProcessPayouts(45, 42)).toBe(true);
        expect(shouldProcessPayouts(44, 42)).toBe(true);
        expect(shouldProcessPayouts(43, 42)).toBe(false);
        expect(shouldProcessPayouts(42, 42)).toBe(false);
    });

    it('should handle cycle boundaries correctly', () => {
        expect(shouldProcessPayouts(21 * 3 + 2, 21 * 3)).toBe(true);
        expect(shouldProcessPayouts(21 * 4 + 1, 21 * 4)).toBe(false);
        expect(shouldProcessPayouts(21 * 4 + 2, 21 * 4)).toBe(true);
    });
});
