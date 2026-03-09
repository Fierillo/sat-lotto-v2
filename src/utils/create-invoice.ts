import { nwc } from "@getalby/sdk";

export async function createNwcInvoice(nwcUrl: string, amountSats: number, description: string) {
  const client = new nwc.NWCClient({
    nostrWalletConnectUrl: nwcUrl
  });

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
    try {
      client.close();
    } catch {}
  }
}
