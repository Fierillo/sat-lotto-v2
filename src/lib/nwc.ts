'use client';

import { nwc } from '@getalby/sdk';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

let client: nwc.NWCClient | null = null;

function getClient(nwcUrl: string): nwc.NWCClient {
    if (!client || client.getNostrWalletConnectUrl() !== nwcUrl) {
        client?.close();
        client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    }
    return client;
}

export const NWC = {
    name: 'nwc' as const,
    canPay: true,

    async payInvoice(invoice: string, nwcUrl: string): Promise<string> {
        const c = getClient(nwcUrl);
        const result = await c.payInvoice({ invoice });
        return result?.preimage || '';
    },

    async lookupInvoice(hash: string, nwcUrl: string): Promise<{ settled: boolean; preimage?: string }> {
        try {
            const tx = await getClient(nwcUrl).lookupInvoice({ payment_hash: hash });
            return { settled: tx.state === 'settled', preimage: tx.preimage || undefined };
        } catch {
            return { settled: false };
        }
    },

    disconnect(): void {
        client?.close();
        client = null;
    }
};

export function restoreSigner(nwcUrl: string): NDKPrivateKeySigner | null {
    const url = new URL(nwcUrl.replace('nostr+walletconnect:', 'http:'));
    const secret = url.searchParams.get('secret');
    return secret ? new NDKPrivateKeySigner(secret) : null;
}
