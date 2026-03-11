import { NextResponse } from 'next/server';
import { queryNeon } from '@/lib/db';
import { createNwcInvoice } from '@/src/utils/create-invoice';
import { verifyEvent } from 'nostr-tools';
import { cachedBlock } from '@/lib/cache';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { signedEvent } = body;
        
        if (!signedEvent) {
            return NextResponse.json({ error: 'Signature required to bet' }, { status: 401 });
        }

        const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;
        if (!verifyEvent(event)) {
            return NextResponse.json({ error: 'Invalid event signature' }, { status: 400 });
        }

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
        if (Math.abs(now - createdAt) > 900) {
            return NextResponse.json({ error: 'Firma desincronizada. Verificá la fecha y hora de tu dispositivo.' }, { status: 400 });
        }

        if (finalBloque !== cachedBlock.target) {
            return NextResponse.json({ error: `Invalid target block. Expected ${cachedBlock.target}, got ${finalBloque}` }, { status: 400 });
        }

        const realTimeResp = await fetch('https://mempool.space/api/blocks/tip/height');
        const realTimeHeight = parseInt(await realTimeResp.text(), 10);
        const isFrozen = (realTimeHeight || cachedBlock.height) >= finalBloque - 2;
        if (isFrozen) {
            return NextResponse.json({ error: 'Betting is closed for this block (Fase Frozen)' }, { status: 403 });
        }

        const existingBet = await queryNeon('SELECT is_paid, selected_number FROM lotto_bets WHERE pubkey = $1 AND target_block = $2', [finalPubkey, finalBloque]);
        
        if (existingBet[0]?.is_paid) {
            if (existingBet[0].selected_number === finalNumero) {
                return NextResponse.json({ message: 'You already have a paid bet for this number. Good luck!' });
            }
        }

        const unpaidCount = await queryNeon(`
            SELECT count(*) FROM lotto_bets 
            WHERE pubkey = $1 AND is_paid = FALSE 
            AND created_at > NOW() - INTERVAL '10 minutes'
        `, [finalPubkey]);
        
        if (parseInt(unpaidCount[0].count) > 5) {
            return NextResponse.json({ error: 'Too many unpaid invoices. Please wait 10 minutes or pay your bets.' }, { status: 429 });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) return NextResponse.json({ error: 'Server NWC_URL not configured' }, { status: 500 });

        let invoice: any;
        try {
            invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto Block ${finalBloque} - Num ${finalNumero}`);
        } catch (e: any) {
            return NextResponse.json({ error: `NWC error: ${e.message}. Make sure your NWC connection has make_invoice permission.` }, { status: 500 });
        }

        const pr = invoice.invoice || invoice.payment_request || invoice.paymentRequest;
        const hash = invoice.payment_hash || invoice.paymentHash;

        if (!pr) {
            return NextResponse.json({ error: 'NWC returned an empty invoice' }, { status: 500 });
        }

        await queryNeon(`
            INSERT INTO lotto_bets (pubkey, target_block, selected_number, payment_request, payment_hash, is_paid, betting_block, alias, nostr_event_id)
            VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8)
            ON CONFLICT (pubkey, target_block) DO UPDATE SET 
                is_paid = CASE WHEN lotto_bets.selected_number = EXCLUDED.selected_number THEN lotto_bets.is_paid ELSE FALSE END,
                selected_number = EXCLUDED.selected_number, 
                payment_request = EXCLUDED.payment_request,
                payment_hash = EXCLUDED.payment_hash,
                betting_block = EXCLUDED.betting_block,
                alias = EXCLUDED.alias,
                nostr_event_id = EXCLUDED.nostr_event_id,
                created_at = NOW()
        `, [finalPubkey, finalBloque, finalNumero, pr, hash, cachedBlock.height, finalAlias, eventId]);

        if (finalAlias) {
            await queryNeon('INSERT INTO lotto_identities (pubkey, alias) VALUES ($1, $2) ON CONFLICT (pubkey) DO UPDATE SET alias = EXCLUDED.alias', [finalPubkey, finalAlias]);
        }

        return NextResponse.json({ paymentRequest: pr, paymentHash: hash });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
