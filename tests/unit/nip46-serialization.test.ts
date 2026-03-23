import { describe, it, expect } from 'vitest';

describe('NIP-46 Session Serialization', () => {
    interface BunkerSession {
        bunkerTarget: string;
        localSignerPrivkey: string;
        remotePubkey: string;
    }

    function serializeSession(session: BunkerSession): string {
        return JSON.stringify(session);
    }

    function deserializeSession(data: string): BunkerSession {
        return JSON.parse(data);
    }

    it('should serialize and deserialize session correctly', () => {
        const session: BunkerSession = {
            bunkerTarget: 'bunker://abc123...',
            localSignerPrivkey: 'secret_key_123',
            remotePubkey: 'remote_pubkey_456'
        };

        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);

        expect(deserialized).toEqual(session);
    });

    it('should preserve all fields during round-trip', () => {
        const session: BunkerSession = {
            bunkerTarget: 'bunker://3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9',
            localSignerPrivkey: 'nsec1234567890abcdef',
            remotePubkey: 'npub1234567890abcdef'
        };

        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);

        expect(deserialized.bunkerTarget).toBe(session.bunkerTarget);
        expect(deserialized.localSignerPrivkey).toBe(session.localSignerPrivkey);
        expect(deserialized.remotePubkey).toBe(session.remotePubkey);
    });

    it('should handle special characters in privkey', () => {
        const session: BunkerSession = {
            bunkerTarget: 'bunker://abc',
            localSignerPrivkey: 'nsec_with_special_chars_!@#$%',
            remotePubkey: 'npub123'
        };

        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);

        expect(deserialized.localSignerPrivkey).toBe(session.localSignerPrivkey);
    });
});

describe('Block Height Calculations', () => {
    function getLastResolvedTarget(currentHeight: number): number {
        return Math.floor(currentHeight / 21) * 21;
    }

    it('should calculate last resolved target correctly', () => {
        expect(getLastResolvedTarget(840000)).toBe(840000);
        expect(getLastResolvedTarget(840020)).toBe(840000);
        expect(getLastResolvedTarget(840021)).toBe(840021);
        expect(getLastResolvedTarget(21)).toBe(21);
        expect(getLastResolvedTarget(22)).toBe(21);
    });

    it('should handle boundary conditions', () => {
        expect(getLastResolvedTarget(0)).toBe(0);
        expect(getLastResolvedTarget(1)).toBe(0);
        expect(getLastResolvedTarget(20)).toBe(0);
        expect(getLastResolvedTarget(21)).toBe(21);
    });

    it('should calculate correct cycles', () => {
        expect(getLastResolvedTarget(21 * 0)).toBe(0);
        expect(getLastResolvedTarget(21 * 1)).toBe(21);
        expect(getLastResolvedTarget(21 * 2)).toBe(42);
        expect(getLastResolvedTarget(21 * 10)).toBe(210);
    });
});

describe('Number Range Validation', () => {
    function isValidBetNumber(num: number): boolean {
        return Number.isInteger(num) && num >= 1 && num <= 21;
    }

    it('should accept valid bet numbers', () => {
        for (let i = 1; i <= 21; i++) {
            expect(isValidBetNumber(i)).toBe(true);
        }
    });

    it('should reject invalid numbers', () => {
        const invalidNumbers = [0, -1, 22, 100, 0.5, -0.5, Infinity, NaN];
        
        for (const num of invalidNumbers) {
            expect(isValidBetNumber(num)).toBe(false);
        }
    });

    it('should reject non-number types', () => {
        expect(isValidBetNumber(undefined as any)).toBe(false);
        expect(isValidBetNumber(null as any)).toBe(false);
        expect(isValidBetNumber('21' as any)).toBe(false);
    });
});
