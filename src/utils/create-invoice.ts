import { nwc } from "@getalby/sdk";

export async function createNwcInvoice(nwcUrl: string, amountSats: number, description: string) {
  const client = new nwc.NWCClient({
    nostrWalletConnectUrl: nwcUrl
  });

  try {
    return await client.makeInvoice({
      amount: amountSats * 1000,
      description
    });
  } finally {
    client.close();
  }
}
