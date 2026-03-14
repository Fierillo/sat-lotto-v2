/**
 * NWC: Nostr Wallet Connect (NIP-47)
 * Always can pay. Uses @getalby/sdk.
 */

import { nwc } from '@getalby/sdk';

let client: nwc.NWCClient | null = null;

function getClient(nwcUrl?: string): nwc.NWCClient {
    const url = nwcUrl || (typeof window !== 'undefined' ? localStorage.getItem('satlotto_nwc') : null);
    if (!url) throw new Error('No NWC URL configured');

    if (!client || client.getNostrWalletConnectUrl() !== url) {
        client?.close();
        client = new nwc.NWCClient({ nostrWalletConnectUrl: url });
    }
    return client;
}

export const NWC = {
    name: 'nwc' as const,
    canPay: true,

    getPublicKey(nwcUrl?: string): Promise<string> {
        const c = getClient(nwcUrl);
        return Promise.resolve(c.publicKey);
    },

    async getBalance(nwcUrl?: string): Promise<number> {
        const c = getClient(nwcUrl);
        const data = await c.getBalance();
        return Math.floor(data.balance / 1000);  // msats → sats
    },

    async createInvoice(amountSats: number, description: string, nwcUrl?: string): Promise<{ paymentRequest: string; paymentHash: string }> {
        const c = getClient(nwcUrl);
        const tx = await c.makeInvoice({
            amount: amountSats * 1000,  // sats → msats
            description: description
        });
        return {
            paymentRequest: tx.invoice,
            paymentHash: tx.payment_hash
        };
    },

    async payInvoice(invoice: string, paymentHash?: string): Promise<string> {
        // NWC pay goes server-side — server pays AND confirms the bet in one call
        const res = await fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice, paymentHash })
        });
        const data = await res.json();
        if (!data.paid) throw new Error(data.error || 'Payment failed');
        return data.preimage || '';
    },

    async lookupInvoice(hash: string, nwcUrl?: string): Promise<{ settled: boolean; preimage?: string }> {
        const c = getClient(nwcUrl);
        try {
            const tx = await c.lookupInvoice({ payment_hash: hash });
            return {
                settled: tx.state === 'settled',
                preimage: tx.preimage || undefined
            };
        } catch {
            return { settled: false };
        }
    },

    disconnect(): void {
        client?.close();
        client = null;
    }
};
