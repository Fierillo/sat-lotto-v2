import { NextResponse } from 'next/server';
import { nwc } from '@getalby/sdk';
import { verifyEvent } from 'nostr-tools';
import { queryNeon, dbGet } from '@/src/lib/db';
import { getInvoiceFromLNAddress } from '@/src/lib/ln';
import { sendDM, ensureNdkConnected } from '@/src/lib/nostr';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';
import type { ClaimApiResponse } from '@/src/types/identity';

export async function POST(request: Request, { params }: { params: Promise<{ pubkey: string }> }) {
    const { pubkey } = await params;

    try {
        const body = await request.json();
        const { signedEvent } = body;

        if (!signedEvent) {
            return NextResponse.json({ error: 'Signature required' }, { status: 401 });
        }

        const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;
        if (!verifyEvent(event)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        if (event.pubkey !== pubkey) {
            return NextResponse.json({ error: 'Pubkey mismatch' }, { status: 400 });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - event.created_at) > 300) {
            return NextResponse.json({ error: 'Signature expired' }, { status: 400 });
        }

        const clientIP = await getClientIP(request);
        const rateCheck = await checkRateLimit('identity:ip', clientIP);
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const identity = await dbGet<{ 
            lud16: string | null; 
            can_claim: boolean; 
            sats_pending: number 
        }>('lotto_identities', { pubkey });

        if (!identity?.can_claim || identity?.sats_pending <= 0) {
            const response: ClaimApiResponse = {
                claimed: 0,
                error: 'No hay premio pendiente para reclamar'
            };
            return NextResponse.json(response, { status: 400 });
        }

        const lud16 = identity.lud16;
        if (!lud16) {
            const response: ClaimApiResponse = {
                claimed: 0,
                error: 'Lightning address no configurada'
            };
            return NextResponse.json(response, { status: 400 });
        }

        const amount = identity.sats_pending;

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) {
            return NextResponse.json({ error: 'NWC not configured' }, { status: 500 });
        }

        const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });

        try {
            const invoice = await getInvoiceFromLNAddress(lud16, amount);
            if (!invoice) {
                const response: ClaimApiResponse = {
                    claimed: 0,
                    error: 'No se pudo generar invoice'
                };
                return NextResponse.json(response, { status: 500 });
            }

            await nwcClient.payInvoice({ invoice });

            await queryNeon(`
                UPDATE lotto_identities
                SET sats_earned = sats_earned + $1,
                    sats_pending = 0,
                    can_claim = FALSE
                WHERE pubkey = $2
            `, [amount, pubkey]);

            await queryNeon(`
                UPDATE lotto_payouts
                SET status = 'paid'
                WHERE pubkey = $1 AND type = 'winner' AND status = 'failed'
            `, [pubkey]);

            await ensureNdkConnected();
            await sendDM(pubkey, `¡Listo! Ya te envié tus ${amount} sats a ${lud16}. ¡Gracias por jugar! ⚡`);

            const response: ClaimApiResponse = {
                claimed: amount,
                lud16: lud16
            };
            return NextResponse.json(response);

        } catch (e: any) {
            console.error('[Claim] Error:', e.message);
            return NextResponse.json({ 
                error: 'Error al procesar el pago',
                claimed: 0 
            }, { status: 500 });
        } finally {
            try { nwcClient.close(); } catch {}
        }
    } catch (e: any) {
        console.error('[Claim] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}