import { describe, it, expect } from 'vitest';

describe('Bunker URL Parsing', () => {
    function parseBunkerUrl(bunkerUrl: string): { isValid: boolean; pubkey: string | null } {
        const bunkerPubkeyMatch = bunkerUrl.match(/^bunker:\/\/([a-f0-9]{64})/i);
        const bunkerPubkey = bunkerPubkeyMatch ? bunkerPubkeyMatch[1] : null;
        return {
            isValid: bunkerPubkey !== null,
            pubkey: bunkerPubkey
        };
    }

    it('should parse valid bunker URL with 64 char hex pubkey', () => {
        const url = 'bunker://a1b2c3d4e5f678901234567890123456789012345678901234567890abcd1234';
        const result = parseBunkerUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.pubkey).toBe('a1b2c3d4e5f678901234567890123456789012345678901234567890abcd1234');
    });

    it('should accept uppercase hex characters', () => {
        const url = 'bunker://ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789';
        const result = parseBunkerUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.pubkey).toBe('ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789');
    });

    it('should reject bunker URL with too short pubkey', () => {
        const url = 'bunker://a1b2c3d4e5f678901234567890123456789012345678901234567890ab';
        const result = parseBunkerUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.pubkey).toBe(null);
    });

    it('should reject bunker URL with invalid characters', () => {
        const url = 'bunker://a1b2c3d4e5f678901234567890123456789012345678901234567890abxz';
        const result = parseBunkerUrl(url);
        expect(result.isValid).toBe(false);
    });

    it('should reject non-bunker URLs', () => {
        const urls = [
            'nostrconnect://bunker123',
            'https://bunker.example.com',
            'bunker://invalid!@#$%',
            'bunker://',
            'bunker://gg',
        ];
        
        for (const url of urls) {
            const result = parseBunkerUrl(url);
            expect(result.isValid).toBe(false);
        }
    });

    it('should handle real-world bunker URLs', () => {
        const url = 'bunker://3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9';
        const result = parseBunkerUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.pubkey).toBe('3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9');
    });
});
