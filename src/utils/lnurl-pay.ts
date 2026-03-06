import { LightningAddress } from "@getalby/lightning-tools";

export async function requestLnurlInvoice(address: string, amountSats: number) {
  const ln = new LightningAddress(address);
  await ln.fetch();
  return ln.requestInvoice({ satoshi: amountSats });
}
