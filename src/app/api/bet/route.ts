import { NextResponse } from 'next/server';
import { queryNeon, dbGet, dbGetAll, dbInsert, dbUpdate } from '@/src/lib/db';
import { createNwcInvoice, lookupNwcInvoice, payNwcInvoice } from '@/src/lib/nwc';
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

            const confirmPubkey = await dbGet<{ pubkey: string }>('lotto_bets', { payment_hash: paymentHash });
            
            if (confirmPubkey) {
                const rateCheck = await checkRateLimit('bet:confirm:pubkey', confirmPubkey.pubkey);
                if (!rateCheck.allowed) {
                    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
                }
            }
            
            const tx = await lookupNwcInvoice(nwcUrl, paymentHash) as any;
            if (tx && (tx.settled || tx.preimage)) {
                const bet = await dbGet<{id: number, pubkey: string, target_block: number, selected_number: number, is_paid: boolean}>('lotto_bets', { payment_hash: paymentHash });
                
                if (bet?.is_paid) {
                    return NextResponse.json({ error: 'Estas pagando 2 veces por el mismo numero!' }, { status: 409 });
                }
                
                console.log('[DEBUG BET] Pago confirmado, actualizando is_paid=true');
                await dbUpdate('lotto_bets', { payment_hash: paymentHash }, { is_paid: true });

                console.log('[DEBUG BET] Bet encontrado:', bet);
                if (bet) {
                    const existingPayout = await dbGet<{id: number}>('lotto_payouts', { 
                        pubkey: bet.pubkey, 
                        block_height: bet.target_block, 
                        type: 'bet' 
                    });
                    if (!existingPayout) {
                        await dbInsert('lotto_payouts', {
                            pubkey: bet.pubkey,
                            block_height: bet.target_block,
                            amount: 21,
                            fee: 2,
                            type: 'bet',
                            status: 'paid',
                            tx_hash: paymentHash,
                            bet_id: bet.id
                        });
                        await queryNeon(`DELETE FROM lotto_payouts WHERE id NOT IN (SELECT id FROM lotto_payouts ORDER BY id DESC LIMIT 210)`);
                    }
                }

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
        const finalNip05 = betContent.nip05;
        const eventId = event.id;
        const createdAt = event.created_at;

        if (isNaN(finalNumero) || finalNumero < 1 || finalNumero > 21) {
            return NextResponse.json({ error: 'Invalid number. Must be between 1 and 21.' }, { status: 400 });
        }

        const existingEvent = await dbGetAll<{ id: number }>('lotto_bets', { nostr_event_id: eventId });
        if (existingEvent.length > 0) {
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

        const lastBet = await queryNeon(`
            SELECT selected_number FROM lotto_bets 
            WHERE pubkey = $1 AND target_block = $2 AND is_paid = TRUE
            ORDER BY id DESC LIMIT 1
        `, [finalPubkey, finalBloque]);

        if (lastBet.length > 0 && lastBet[0].selected_number === finalNumero) {
            return NextResponse.json({ error: 'Estas pagando 2 veces por el mismo numero!' }, { status: 409 });
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

        await dbInsert('lotto_bets', {
            pubkey: finalPubkey,
            target_block: finalBloque,
            selected_number: finalNumero,
            payment_request: pr,
            payment_hash: hash,
            is_paid: false,
            betting_block: cachedBlock.height,
            nip05: finalNip05,
            nostr_event_id: eventId
        });

        await queryNeon(`DELETE FROM lotto_bets WHERE id NOT IN (SELECT id FROM lotto_bets ORDER BY id DESC LIMIT 210)`);

        if (finalNip05) {
            await queryNeon('INSERT INTO lotto_identities (pubkey, nip05) VALUES ($1, $2) ON CONFLICT (pubkey) DO UPDATE SET nip05 = EXCLUDED.nip05', [finalPubkey, finalNip05]);
        }

        return NextResponse.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        console.error('[Bet POST] Error:', err.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const paymentHash = searchParams.get('paymentHash') || '';

        if (paymentHash) {
            const nwcUrl = process.env.NWC_URL;
            if (!nwcUrl) return NextResponse.json({ error: 'Server NWC not configured' }, { status: 500 });

            const tx = await lookupNwcInvoice(nwcUrl, paymentHash) as any;
            if (tx && (tx.settled || tx.preimage)) {
                return NextResponse.json({ confirmed: true, settled: true });
            }
            return NextResponse.json({ confirmed: false, settled: false });
        }

        const block = parseInt(searchParams.get('block') || '');
        const number = parseInt(searchParams.get('number') || '');
        const pubkey = searchParams.get('pubkey') || '';

        if (!block || !number || !pubkey) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const clientIP = await getClientIP(request);

        // Only rate limit by IP for GET (no pubkey check — attacker would only block themselves)
        const rateCheckIP = await checkRateLimit('bet:create:ip', clientIP);
        if (!rateCheckIP.allowed) {
            return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
        }

        await syncData();

        if (isNaN(number) || number < 1 || number > 21) {
            return NextResponse.json({ error: 'Invalid number. Must be between 1 and 21.' }, { status: 400 });
        }

        const lastBet = await queryNeon(`
            SELECT selected_number FROM lotto_bets 
            WHERE pubkey = $1 AND target_block = $2 AND is_paid = TRUE
            ORDER BY id DESC LIMIT 1
        `, [pubkey, block]);

        if (lastBet.length > 0 && lastBet[0].selected_number === number) {
            return NextResponse.json({ error: 'Estas pagando 2 veces por el mismo numero!' }, { status: 409 });
        }

        const existingBet = await dbGet<{ payment_request: string; payment_hash: string }>('lotto_bets', { pubkey, target_block: block, selected_number: number, is_paid: false });
        if (existingBet) {
            return NextResponse.json({ 
                paymentRequest: existingBet.payment_request, 
                paymentHash: existingBet.payment_hash 
            });
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

        await dbInsert('lotto_bets', {
            pubkey,
            target_block: block,
            selected_number: number,
            payment_request: pr,
            payment_hash: hash,
            is_paid: false,
            betting_block: cachedBlock.height,
            nip05: null,
            nostr_event_id: 'pending_amber_' + hash
        });

        return NextResponse.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        console.error('[Bet GET] Error:', err.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
