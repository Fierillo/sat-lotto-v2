import { describe, it, expect } from 'vitest';

describe('NIP-07 Payment Flow', () => {
    function isNotEnabledError(e: unknown): boolean {
        const msg = e instanceof Error ? e.message : String(e);
        return msg.includes('not enabled') || 
               msg.includes('not authorized') || 
               msg.includes('Enabled failed') ||
               msg.includes('Provider must be enabled');
    }

    it('should detect "not enabled" error', () => {
        const error = new Error('WebLN provider not enabled');
        expect(isNotEnabledError(error)).toBe(true);
    });

    it('should detect "not authorized" error', () => {
        const error = new Error('Payment not authorized');
        expect(isNotEnabledError(error)).toBe(true);
    });

    it('should detect "Enabled failed" error', () => {
        const error = new Error('Enabled failed');
        expect(isNotEnabledError(error)).toBe(true);
    });

    it('should detect "Provider must be enabled" error', () => {
        const error = new Error('Provider must be enabled before calling sendPayment');
        expect(isNotEnabledError(error)).toBe(true);
    });

    it('should NOT flag unrelated errors', () => {
        const errors = [
            new Error('Invoice expired'),
            new Error('Insufficient funds'),
            new Error('Network timeout'),
            new Error('Invalid invoice'),
        ];
        
        for (const error of errors) {
            expect(isNotEnabledError(error)).toBe(false);
        }
    });

    it('should handle string errors', () => {
        expect(isNotEnabledError('not enabled')).toBe(true);
        expect(isNotEnabledError('Something went wrong')).toBe(false);
    });
});

describe('LN Address Validation', () => {
    function isValidLightningAddress(address: string): boolean {
        const parts = address.split('@');
        if (parts.length !== 2) return false;
        const [user, domain] = parts;
        if (!user || user.length < 1) return false;
        if (!domain || !domain.includes('.')) return false;
        return true;
    }

    it('should accept valid Lightning addresses', () => {
        const validAddresses = [
            'satoshi@bitcoin.org',
            'user@ln.example.com',
            'a@b.c',
            'test123@sub.domain.co',
        ];
        
        for (const addr of validAddresses) {
            expect(isValidLightningAddress(addr)).toBe(true);
        }
    });

    it('should reject invalid Lightning addresses', () => {
        const invalidAddresses = [
            'nostr:npub1...',
            'invalid',
            '@nodomain.com',
            'noat.com',
        ];
        
        for (const addr of invalidAddresses) {
            expect(isValidLightningAddress(addr)).toBe(false);
        }
    });
});
