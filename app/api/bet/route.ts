import { NextResponse } from 'next/server';
import { queryNeon } from '@/src/lib/db';
import { createNwcInvoice } from '@/src/utils/create-invoice';
import { lookupNwcInvoice, payNwcInvoice } from '@/src/utils/pay-invoice';
import { verifyEvent } from 'nostr-tools';
import { cachedBlock, syncData } from '@/src/lib/cache';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';

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
        await syncData();
        const body = await request.json();
        const { signedEvent, paymentHash, action } = body;

        const clientIP = await getClientIP(request);

        if ((action === 'confirm' || paymentHash) && !signedEvent) {
            const nwcUrl = process.env.NWC_URL;
            if (!nwcUrl || !paymentHash) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

            const confirmPubkey = await queryNeon(
                'SELECT pubkey FROM lotto_bets WHERE payment_hash = $1',
                [paymentHash]
            );
            
            if (confirmPubkey.length > 0) {
                const rateCheck = await checkRateLimit('bet:confirm:pubkey', confirmPubkey[0].pubkey);
                if (!rateCheck.allowed) {
                    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
                }
            }
            
            const tx = await lookupNwcInvoice(nwcUrl, paymentHash) as any;
            if (tx && (tx.settled || tx.preimage)) {
                await queryNeon('UPDATE lotto_bets SET is_paid = TRUE WHERE payment_hash = $1', [paymentHash]);
                try {
                    const feeInvoice = await getInvoiceFromLNAddress('fierillo@lawalletilla.vercel.app', 2);
                    if (feeInvoice) await payNwcInvoice(nwcUrl, feeInvoice);
                } catch (e) { console.error('[Confirm] Fee payment failed:', e); }
                return NextResponse.json({ confirmed: true });
            }
            return NextResponse.json({ error: 'Not settled' }, { status: 400 });
        }

        if (!signedEvent) return NextResponse.json({ error: 'Signature required to bet' }, { status: 401 });

        const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;

        if (!verifyEvent(event)) return NextResponse.json({ error: 'Invalid event signature' }, { status: 400 });

        const betContent = JSON.parse(event.content);
        const finalPubkey = event.pubkey;
        const finalBloque = parseInt(betContent.bloque);
        const finalNumero = parseInt(betContent.numero);
        const finalAlias = betContent.alias;
        const eventId = event.id;
        const createdAt = event.created_at;

        if (isNaN(finalNumero) || finalNumero < 1 || finalNumero > 21) {
            return NextResponse.json({ error: 'Invalid number. Must be between 1 and 21.' }, { status: 400 });
        }

        const existingEvent = await queryNeon('SELECT count(*) FROM lotto_bets WHERE nostr_event_id = $1', [eventId]);
        if (parseInt(existingEvent[0].count) > 0) {
            return NextResponse.json({ error: 'Esta apuesta ya fue procesada (Replay Attack protection)' }, { status: 409 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - createdAt) > 900) return NextResponse.json({ error: 'Firma desincronizada.' }, { status: 400 });
        if (finalBloque !== cachedBlock.target) return NextResponse.json({ error: 'Invalid target block.' }, { status: 400 });

        const realTimeResp = await fetch('https://mempool.space/api/blocks/tip/height');
        const realTimeHeight = parseInt(await realTimeResp.text(), 10);
        if ((realTimeHeight || cachedBlock.height) >= finalBloque - 2) {
            return NextResponse.json({ error: 'Betting is closed (Frozen)' }, { status: 403 });
        }

        const rateCheckPubkey = await checkRateLimit('bet:create:pubkey', finalPubkey);
        if (!rateCheckPubkey.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        const rateCheckIP = await checkRateLimit('bet:create:ip', clientIP);
        if (!rateCheckIP.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        const alreadyPaid = await queryNeon('SELECT count(*) FROM lotto_bets WHERE pubkey = $1 AND target_block = $2 AND selected_number = $3 AND is_paid = TRUE', [finalPubkey, finalBloque, finalNumero]);
        if (parseInt(alreadyPaid[0].count) > 0) {
            return NextResponse.json({ message: 'You already have a paid bet for this number. Good luck!' });
        }

        const unpaidCount = await queryNeon(`SELECT count(*) FROM lotto_bets WHERE pubkey = $1 AND is_paid = FALSE AND created_at > NOW() - INTERVAL '10 minutes'`, [finalPubkey]);
        if (parseInt(unpaidCount[0].count) > 5) return NextResponse.json({ error: 'Too many unpaid invoices.' }, { status: 429 });

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return NextResponse.json({ error: 'Server NWC_URL not configured' }, { status: 500 });

        let invoice: any;
        try {
            invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`);
        } catch (e: any) {
            return NextResponse.json({ error: `NWC error: ${e.message}` }, { status: 500 });
        }
        const pr = invoice.invoice || invoice.payment_request || invoice.paymentRequest;
        const hash = invoice.payment_hash || invoice.paymentHash;
        if (!pr) return NextResponse.json({ error: 'NWC returned an empty invoice' }, { status: 500 });

        await queryNeon(`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias, nostr_event_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [finalPubkey, finalBloque, finalNumero, pr, hash, false, cachedBlock.height, finalAlias, eventId]);

        if (finalAlias) {
            await queryNeon('INSERT INTO lotto_identities (pubkey, alias) VALUES ($1, $2) ON CONFLICT (pubkey) DO UPDATE SET alias = EXCLUDED.alias', [finalPubkey, finalAlias]);
        }

        return NextResponse.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        console.error('[Bet POST] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const block = parseInt(searchParams.get('block') || '');
        const number = parseInt(searchParams.get('number') || '');
        const pubkey = searchParams.get('pubkey') || '';

        if (!block || !number || !pubkey) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const clientIP = await getClientIP(request);
        const rateCheckPubkey = await checkRateLimit('bet:create:pubkey', pubkey);
        if (!rateCheckPubkey.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        const rateCheckIP = await checkRateLimit('bet:create:ip', clientIP);
        if (!rateCheckIP.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        await syncData();

        if (isNaN(number) || number < 1 || number > 21) {
            return NextResponse.json({ error: 'Invalid number. Must be between 1 and 21.' }, { status: 400 });
        }

        const alreadyPaid = await queryNeon('SELECT count(*) FROM lotto_bets WHERE pubkey = $1 AND target_block = $2 AND selected_number = $3 AND is_paid = TRUE', [pubkey, block, number]);
        if (parseInt(alreadyPaid[0].count) > 0) {
            return NextResponse.json({ error: 'You already have a paid bet for this number.' }, { status: 409 });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return NextResponse.json({ error: 'Server NWC_URL not configured' }, { status: 500 });

        let invoice: any;
        try {
            invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${block} - Num ${number}`);
        } catch (e: any) {
            return NextResponse.json({ error: `NWC error: ${e.message}` }, { status: 500 });
        }
        const pr = invoice.invoice || invoice.payment_request || invoice.paymentRequest;
        const hash = invoice.payment_hash || invoice.paymentHash;
        if (!pr) return NextResponse.json({ error: 'NWC returned an empty invoice' }, { status: 500 });

        await queryNeon(`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias, nostr_event_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [pubkey, block, number, pr, hash, false, cachedBlock.height, null, 'pending_amber_' + hash]);

        return NextResponse.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        console.error('[Bet GET] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
