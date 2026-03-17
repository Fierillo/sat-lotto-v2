/**
 * NIP-07: Browser Extension Signer (Alby, nos2x)
 * Uses window.nostr for signing and window.webln for payments.
 */

export const NIP07 = {
    name: 'nip07' as const,
    canPay: typeof window !== 'undefined' && !!(window as any).webln,

    isAvailable(): boolean {
        return typeof window !== 'undefined' && !!(window as any).nostr;
    },

    async getPublicKey(): Promise<string> {
        if (!(window as any).nostr) throw new Error('NIP-07 extension not available');
        return (window as any).nostr.getPublicKey();
    },

    async signEvent(event: any): Promise<any> {
        if (!(window as any).nostr) throw new Error('NIP-07 extension not available');
        return (window as any).nostr.signEvent(event);
    },

    async payInvoice(invoice: string): Promise<string> {
        const webln = (window as any).webln;
        if (!webln) throw new Error('WebLN not available');
        await webln.enable();
        const result = await webln.sendPayment(invoice);
        return result.preimage;
    }
};
