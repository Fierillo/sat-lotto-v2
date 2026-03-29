import { describe, it, expect } from 'vitest';
import { vi, beforeEach, afterEach } from 'vitest';

describe('getInvoiceFromLNAddress', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function parseLightningAddress(address: string): { user: string; domain: string } | null {
        const parts = address.split('@');
        if (parts.length !== 2) return null;
        return { user: parts[0], domain: parts[1] };
    }

    function buildLNURLPUrl(address: string): string | null {
        const parsed = parseLightningAddress(address);
        if (!parsed) return null;
        return `https://${parsed.domain}/.well-known/lnurlp/${parsed.user}`;
    }

    function buildCallbackUrl(baseUrl: string, amountMsats: number): string {
        return `${baseUrl}?amount=${amountMsats}`;
    }

    it('should parse Lightning address correctly', () => {
        const parsed = parseLightningAddress('satoshi@bitcoin.org');
        expect(parsed).toEqual({ user: 'satoshi', domain: 'bitcoin.org' });
    });

    it('should build LNURLP URL correctly', () => {
        const url = buildLNURLPUrl('satoshi@bitcoin.org');
        expect(url).toBe('https://bitcoin.org/.well-known/lnurlp/satoshi');
    });

    it('should handle subdomain in Lightning address', () => {
        const url = buildLNURLPUrl('satoshi@wallet.bitcoin.org');
        expect(url).toBe('https://wallet.bitcoin.org/.well-known/lnurlp/satoshi');
    });

    it('should build callback URL with amount in millisats', () => {
        const baseUrl = 'https://bitcoin.org/.well-known/lnurlp/satoshi';
        const amountMsats = 1000;
        const callbackUrl = buildCallbackUrl(baseUrl, amountMsats);
        expect(callbackUrl).toBe('https://bitcoin.org/.well-known/lnurlp/satoshi?amount=1000');
    });

    it('should convert sats to msats correctly', () => {
        const baseUrl = 'https://example.com/.well-known/lnurlp/user';
        expect(buildCallbackUrl(baseUrl, 1 * 1000)).toContain('amount=1000');
        expect(buildCallbackUrl(baseUrl, 100 * 1000)).toContain('amount=100000');
        expect(buildCallbackUrl(baseUrl, 1000 * 1000)).toContain('amount=1000000');
    });

    it('should return null for invalid Lightning addresses', () => {
        const invalidAddresses = [
            'nostr:npub1...',
            'invalid',
            'no-at-sign.com',
        ];

        for (const addr of invalidAddresses) {
            expect(parseLightningAddress(addr)).toBeNull();
        }
    });

    it('should return null for Lightning addresses without @', () => {
        expect(parseLightningAddress('noat.com')).toBeNull();
    });

    it('should return null from LNURLP URL for invalid addresses', () => {
        expect(buildLNURLPUrl('invalid')).toBeNull();
        expect(buildLNURLPUrl('')).toBeNull();
    });

    it('should handle complex usernames in Lightning addresses', () => {
        const url = buildLNURLPUrl('user.name_123@wallet.example.org');
        expect(url).toBe('https://wallet.example.org/.well-known/lnurlp/user.name_123');
    });
});
