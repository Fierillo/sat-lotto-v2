import { nwc } from "@getalby/sdk";

export async function payNwcInvoice(nwcUrl: string, invoice: string) {
  const client = new nwc.NWCClient({
    nostrWalletConnectUrl: nwcUrl
  });

  try {
    return await client.payInvoice({
      invoice
    });
  } finally {
    client.close();
  }
}
