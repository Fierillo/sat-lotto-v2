import { describe, it, expect, afterEach } from 'vitest';

describe('restoreSigner', () => {
    function parseNwcSecret(nwcUrl: string): string | null {
        try {
            const url = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
            return url.searchParams.get('secret');
        } catch {
            return null;
        }
    }

    it('should parse secret from NWC URL correctly', () => {
        const url = 'nostr+walletconnect://abcdef123456?secret=mysecret&name=test';
        const secret = parseNwcSecret(url);
        expect(secret).toBe('mysecret');
    });

    it('should return null if secret is missing', () => {
        const url = 'nostr+walletconnect://abcdef123456?name=test';
        const secret = parseNwcSecret(url);
        expect(secret).toBeNull();
    });

    it('should handle URL without nostr+walletconnect prefix', () => {
        const url = 'http://abcdef123456?secret=mysecret';
        const secret = parseNwcSecret(url);
        expect(secret).toBe('mysecret');
    });

    it('should return null for invalid URLs', () => {
        expect(parseNwcSecret('not-a-url')).toBeNull();
    });
});

describe('getPoolBalance env handling', () => {
    const originalEnv = process.env.NWC_URL;

    afterEach(() => {
        process.env.NWC_URL = originalEnv;
    });

    it('should return 0 if NWC_URL is not configured', async () => {
        delete process.env.NWC_URL;
        const { getPoolBalance } = await import('../../src/lib/nwc');
        const balance = await getPoolBalance();
        expect(balance).toBe(0);
    });

    it('should return 0 if NWC_URL is empty string', async () => {
        process.env.NWC_URL = '';
        const { getPoolBalance } = await import('../../src/lib/nwc');
        const balance = await getPoolBalance();
        expect(balance).toBe(0);
    });
});
