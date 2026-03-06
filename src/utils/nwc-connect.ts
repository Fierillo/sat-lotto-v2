import { nwc } from "@getalby/sdk";

export async function getNwcInfo(nwcUrl: string) {
  const client = new nwc.NWCClient({
    nostrWalletConnectUrl: nwcUrl
  });

  try {
    const info = await client.getInfo();
    const balance = await client.getBalance();
    return { info, balance };
  } finally {
    client.close();
  }
}
