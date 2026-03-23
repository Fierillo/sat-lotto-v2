import { describe, it, expect } from 'vitest';

describe('LNURL Resolver', () => {
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
        const callbackUrl = buildCallbackUrl(baseUrl, 1000);
        expect(callbackUrl).toBe('https://bitcoin.org/.well-known/lnurlp/satoshi?amount=1000');
    });

    it('should return null for invalid Lightning addresses', () => {
        const invalidAddresses = [
            'nostr:npub1...',
            'invalid',
            'no-at-sign.com',
        ];
        
        for (const addr of invalidAddresses) {
            expect(buildLNURLPUrl(addr)).toBeNull();
        }
    });

    it('should handle amount conversion correctly', () => {
        const baseUrl = 'https://example.com/.well-known/lnurlp/user';
        
        expect(buildCallbackUrl(baseUrl, 1)).toContain('amount=1');
        expect(buildCallbackUrl(baseUrl, 1000)).toContain('amount=1000');
        expect(buildCallbackUrl(baseUrl, 1000000)).toContain('amount=1000000');
    });
});

describe('Invoice Parsing', () => {
    function extractPreimage(response: { preimage?: string; payment_preimage?: string }): string | null {
        return response.preimage || response.payment_preimage || null;
    }

    function extractPaymentRequest(response: { invoice?: string; payment_request?: string; paymentRequest?: string }): string | null {
        return response.invoice || response.payment_request || response.paymentRequest || null;
    }

    it('should extract preimage from response', () => {
        expect(extractPreimage({ preimage: 'abc123' })).toBe('abc123');
        expect(extractPreimage({ payment_preimage: 'def456' })).toBe('def456');
        expect(extractPreimage({})).toBeNull();
    });

    it('should extract payment request from response', () => {
        expect(extractPaymentRequest({ invoice: 'lnbc1...' })).toBe('lnbc1...');
        expect(extractPaymentRequest({ payment_request: 'lnbc2...' })).toBe('lnbc2...');
        expect(extractPaymentRequest({ paymentRequest: 'lnbc3...' })).toBe('lnbc3...');
        expect(extractPaymentRequest({})).toBeNull();
    });

    it('should prioritize invoice over payment_request', () => {
        const response = {
            invoice: 'lnbc1',
            payment_request: 'lnbc2',
            paymentRequest: 'lnbc3'
        };
        expect(extractPaymentRequest(response)).toBe('lnbc1');
    });
});
