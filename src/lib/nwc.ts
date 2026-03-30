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

function withSuppressedWarnings<T>(fn: () => Promise<T>): Promise<T> {
    const originalWarn = console.warn;
    console.warn = () => {};
    return fn().finally(() => { console.warn = originalWarn; });
}

function withSuppressedClientWarnings<T>(nwcUrl: string, fn: (c: nwc.NWCClient) => Promise<T>): Promise<T> {
    return withSuppressedWarnings(async () => {
        const c = getClient(nwcUrl);
        return fn(c);
    });
}

export const NWC = {
    name: 'nwc' as const,
    canPay: true,

    async payInvoice(invoice: string, nwcUrl: string): Promise<string> {
        return withSuppressedClientWarnings(nwcUrl, async (c) => {
            const result = await c.payInvoice({ invoice });
            return result?.preimage || '';
        });
    },

    async lookupInvoice(hash: string, nwcUrl: string): Promise<{ settled: boolean; preimage?: string; amount?: number }> {
        return withSuppressedClientWarnings(nwcUrl, async (c) => {
            try {
                const tx = await c.lookupInvoice({ payment_hash: hash });
                return { settled: tx.state === 'settled', preimage: tx.preimage || undefined, amount: tx.amount };
            } catch {
                return { settled: false };
            }
        });
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

export async function getPoolBalance(): Promise<number> {
    const nwcUrl = process.env.NWC_URL;
    if (!nwcUrl) return 0;

    return withSuppressedWarnings(async () => {
        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        try {
            const balanceData = await client.getBalance();
            return Math.floor(balanceData.balance / 1000);
        } catch (e: any) {
            console.error('[NWC] Balance timeout');
            throw new Error('NWC timeout');
        } finally {
            try { client.close(); } catch {}
        }
    });
}

export async function createNwcInvoice(nwcUrl: string, amountSats: number, description: string): Promise<{ invoice: string; payment_hash: string }> {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        return await withSuppressedWarnings(() =>
            client.makeInvoice({
                amount: amountSats * 1000,
                description: description || 'SatLotto Bet'
            })
        ) as { invoice: string; payment_hash: string };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Alby SDK makeInvoice failed';
        console.error('[createNwcInvoice] Alby SDK error:', message);
        throw new Error(message);
    } finally {
        try { client.close(); } catch {}
    }
}

export async function payNwcInvoice(nwcUrl: string, invoice: string): Promise<{ preimage?: string }> {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        return await withSuppressedWarnings(() => client.payInvoice({ invoice }));
    } finally {
        client.close();
    }
}

export async function lookupNwcInvoice(nwcUrl: string, paymentHash: string): Promise<{ settled: boolean; preimage?: string; amount?: number }> {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const result = await withSuppressedWarnings(() => client.lookupInvoice({ payment_hash: paymentHash })) as { settled_at?: number; preimage?: string; amount?: number };
        return { settled: !!result.settled_at, preimage: result.preimage, amount: result.amount };
    } finally {
        client.close();
    }
}

export async function getNwcInfo(nwcUrl: string): Promise<{ info: { alias?: string; pubkey?: string }; balance: { balance: number } }> {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('La wallet no responde (Timeout 5s)')), 5000));
        const [info, balance] = await Promise.race([
            withSuppressedWarnings(() => Promise.all([client.getInfo(), client.getBalance()])),
            timeout
        ]) as [{ alias?: string; pubkey?: string }, { balance: number }];
        return { info, balance };
    } finally {
        client.close();
    }
}
