import { nwc } from "@getalby/sdk";

export async function getNwcInfo(nwcUrl: string) {
  const client = new nwc.NWCClient({
    nostrWalletConnectUrl: nwcUrl
  });

  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('La wallet no responde (Timeout 5s)')), 5000));
    const infoPromise = client.getInfo();
    const balancePromise = client.getBalance();
    
    const [info, balance] = await Promise.race([
      Promise.all([infoPromise, balancePromise]),
      timeout
    ]) as [any, any];

    return { info, balance };
  } finally {
    client.close();
  }
}
