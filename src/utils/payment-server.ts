/**
 * payment-server.ts: Server-side NWC invoice helpers
 *
 * Used by API routes to create/pay/lookup invoices via the server's NWC wallet.
 * Client-side payment orchestration is in payment.ts.
 */

import { nwc } from '@getalby/sdk';

export async function createNwcInvoice(nwcUrl: string, amountSats: number, description: string) {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const response = await client.makeInvoice({
            amount: amountSats * 1000,
            description: description || 'SatLotto Bet'
        });
        return response;
    } catch (err: any) {
        console.error('[createNwcInvoice] Alby SDK error:', err);
        throw new Error(err.message || 'Alby SDK makeInvoice failed');
    } finally {
        try { client.close(); } catch {}
    }
}

export async function payNwcInvoice(nwcUrl: string, invoice: string) {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        return await client.payInvoice({ invoice });
    } finally {
        client.close();
    }
}

export async function lookupNwcInvoice(nwcUrl: string, paymentHash: string) {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        return await client.lookupInvoice({ payment_hash: paymentHash });
    } finally {
        client.close();
    }
}

export async function getNwcInfo(nwcUrl: string) {
    const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
    try {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('La wallet no responde (Timeout 5s)')), 5000));
        const [info, balance] = await Promise.race([
            Promise.all([client.getInfo(), client.getBalance()]),
            timeout
        ]) as [any, any];
        return { info, balance };
    } finally {
        client.close();
    }
}
