/**
 * NIP-07: Browser Extension Signer (Alby, nos2x)
 * Uses window.nostr for signing and window.webln for payments.
 */

import type { UnsignedEvent, SignedEvent } from '../types';

export const NIP07 = {
    name: 'nip07' as const,
    canPay: typeof window !== 'undefined' && !!window.webln,

    isAvailable(): boolean {
        return typeof window !== 'undefined' && !!window.nostr;
    },

    async getPublicKey(): Promise<string> {
        if (!window.nostr) throw new Error('NIP-07 extension not available');
        return window.nostr.getPublicKey();
    },

    async signEvent(event: UnsignedEvent): Promise<SignedEvent> {
        if (!window.nostr) throw new Error('NIP-07 extension not available');
        return window.nostr.signEvent(event);
    },

    async payInvoice(invoice: string): Promise<string> {
        if (!window.webln) throw new Error('WebLN not available');
        await window.webln.enable();
        const result = await window.webln.sendPayment(invoice);
        return result.preimage;
    }
};
