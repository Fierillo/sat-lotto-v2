export async function getInvoiceFromLNAddress(address: string, amountSats: number): Promise<string | null> {
    try {
        const [user, domain] = address.split('@');
        const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
        const lnurlData = await lnurlRes.json();
        const callback = lnurlData.callback;
        const amountMsats = amountSats * 1000;
        const invRes = await fetch(`${callback}?amount=${amountMsats}`);
        const invData = await invRes.json();
        return invData.pr || invData.payment_request;
    } catch (e: any) {
        console.error(`[LN] Failed to get invoice from ${address}:`, e.message?.slice(0, 50));
        return null;
    }
}
