import { nwc } from "@getalby/sdk";

export async function lookupNwcInvoice(nwcUrl: string, paymentHash: string) {
    const client = new nwc.NWCClient({
        nostrWalletConnectUrl: nwcUrl
    });

    try {
        return await client.lookupInvoice({
            payment_hash: paymentHash
        });
    } finally {
        client.close();
    }
}
