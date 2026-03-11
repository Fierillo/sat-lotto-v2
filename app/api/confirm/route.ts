import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { lookupNwcInvoice, payNwcInvoice } from '@/src/utils/pay-invoice';

async function getInvoiceFromLNAddress(address: string, amountSats: number): Promise<string | null> {
    try {
        const [user, domain] = address.split('@');
        const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
        const lnurlData = await lnurlRes.json();
        const callback = lnurlData.callback;
        const amountMsats = amountSats * 1000;
        const invRes = await fetch(`${callback}?amount=${amountMsats}`);
        const invData = await invRes.json();
        return invData.pr || invData.payment_request;
    } catch (e) {
        console.error('[Fee] Failed to get invoice:', e);
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const { paymentHash } = await request.json();
        const nwcUrl = process.env.NWC_URL;
        
        if (!nwcUrl || !paymentHash) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }
        
        const tx = await lookupNwcInvoice(nwcUrl, paymentHash) as any;
        
        if (tx && (tx.settled || tx.preimage)) {
            await queryNeon('UPDATE lotto_bets SET is_paid = TRUE WHERE payment_hash = $1', [paymentHash]);

            try {
                const feeInvoice = await getInvoiceFromLNAddress('fierillo@lawalletilla.vercel.app', 2);
                if (feeInvoice) {
                    await payNwcInvoice(nwcUrl, feeInvoice);
                }
            } catch (e) {
                console.error('[Confirm] Fee payment failed:', e);
            }

            return NextResponse.json({ confirmed: true });
        }
        
        return NextResponse.json({ error: 'Not settled' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}