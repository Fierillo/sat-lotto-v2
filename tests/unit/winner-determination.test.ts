import { describe, it, expect } from 'vitest';

describe('Winner Determination', () => {
    function calculateWinningNumber(blockHash: string): number {
        const winningNumber = Number((BigInt('0x' + blockHash) % BigInt(21)) + BigInt(1));
        return winningNumber;
    }

    it('should calculate winning number between 1 and 21', () => {
        const testHashes = [
            '0000000000000000000000000000000000000000000000000000000000000000',
            'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            'a1b2c3d4e5f678901234567890123456789012345678901234567890abcd',
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ];

        for (const hash of testHashes) {
            const result = calculateWinningNumber(hash);
            expect(result).toBeGreaterThanOrEqual(1);
            expect(result).toBeLessThanOrEqual(21);
        }
    });

    it('should produce deterministic results for same hash', () => {
        const hash = '0000000000000000000000000000000000000000000000000000000000000001';
        const result1 = calculateWinningNumber(hash);
        const result2 = calculateWinningNumber(hash);
        expect(result1).toBe(result2);
    });

    it('should handle hash with leading zeros correctly', () => {
        const hash = '0000000000000000000000000000000000000000000000000000000000000001';
        const result = calculateWinningNumber(hash);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(21);
    });

    it('should handle hash with all f characters', () => {
        const hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const result = calculateWinningNumber(hash);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(21);
    });

    it('should distribute results across range (statistical test)', () => {
        const counts: Record<number, number> = {};
        for (let i = 1; i <= 21; i++) counts[i] = 0;
        
        const iterations = 2100;
        for (let i = 0; i < iterations; i++) {
            const hash = i.toString(16).padStart(64, '0');
            const result = calculateWinningNumber(hash);
            if (counts[result] !== undefined) counts[result]++;
        }

        for (let i = 1; i <= 21; i++) {
            expect(counts[i]).toBeGreaterThan(0);
        }
    });
});
