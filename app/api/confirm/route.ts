import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { lookupNwcInvoice } from '@/src/utils/pay-invoice';

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
            return NextResponse.json({ confirmed: true });
        }
        
        return NextResponse.json({ error: 'Not settled' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}