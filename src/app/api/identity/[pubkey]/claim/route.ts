import { NextResponse } from 'next/server';
import { nwc } from '@getalby/sdk';
import { verifyEvent } from 'nostr-tools';
import { queryNeon, dbGet } from '@/src/lib/db';
import { getInvoiceFromLNAddress } from '@/src/lib/ln';
import { sendDM, ensureNdkConnected } from '@/src/lib/nostr';
import { checkRateLimit, getClientIP } from '@/src/lib/rate-limiter';

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

        const identity = await dbGet<{ lud16: string | null }>('lotto_identities', { pubkey });
        const lud16 = identity?.lud16;

        if (!lud16) {
            const pending = await queryNeon(`
                SELECT COALESCE(SUM(amount), 0) as pending_amount
                FROM lotto_payouts
                WHERE pubkey = $1 AND type = 'winner' AND status = 'failed'
            `, [pubkey]);
            return NextResponse.json({
                error: 'Lightning address not configured',
                claimed: 0,
                pendingAmount: pending[0]?.pending_amount || 0
            }, { status: 400 });
        }

        const pendingPayouts = await queryNeon(`
            SELECT id, block_height, amount
            FROM lotto_payouts
            WHERE pubkey = $1 AND type = 'winner' AND status = 'failed'
            ORDER BY block_height ASC
        `, [pubkey]);

        if (pendingPayouts.length === 0) {
            return NextResponse.json({
                claimed: 0,
                message: 'No pending payouts to claim'
            });
        }

        const nwcUrl = process.env.NWC_URL;
        if (!nwcUrl) {
            return NextResponse.json({ error: 'NWC not configured' }, { status: 500 });
        }

        const nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });
        let totalClaimed = 0;
        let totalFailed = 0;
        const failedBlocks: number[] = [];

        try {
            for (const payout of pendingPayouts) {
                try {
                    const invoice = await getInvoiceFromLNAddress(lud16, payout.amount);
                    if (!invoice) {
                        failedBlocks.push(payout.block_height);
                        totalFailed += payout.amount;
                        continue;
                    }

                    await nwcClient.payInvoice({ invoice });

                    await queryNeon(`
                        UPDATE lotto_payouts SET status = 'paid'
                        WHERE id = $1
                    `, [payout.id]);

                    await queryNeon(`
                        UPDATE lotto_identities
                        SET sats_earned = sats_earned + $1, has_confirmed = true
                        WHERE pubkey = $2
                    `, [payout.amount, pubkey]);

                    totalClaimed += payout.amount;
                } catch (e: any) {
                    console.error(`[Claim] Payout failed for block ${payout.block_height}:`, e.message?.slice(0, 50));
                    failedBlocks.push(payout.block_height);
                    totalFailed += payout.amount;
                }
            }
        } finally {
            try { nwcClient.close(); } catch {}
        }

        if (totalClaimed > 0) {
            await ensureNdkConnected();
            await sendDM(pubkey, `¡Listo! 🇦🇷 Ya te envié tus ${totalClaimed} sats a ${lud16}. ¡Gracias por jugar! ⚡`);
        }

        const remainingPending = await queryNeon(`
            SELECT COALESCE(SUM(amount), 0) as pending_amount
            FROM lotto_payouts
            WHERE pubkey = $1 AND type = 'winner' AND status = 'failed'
        `, [pubkey]);

        return NextResponse.json({
            claimed: totalClaimed,
            failed: totalFailed,
            pendingAmount: remainingPending[0]?.pending_amount || 0,
            message: totalClaimed > 0
                ? `${totalClaimed} sats enviadas a ${lud16}`
                : 'No se pudieron procesar los pagos',
            ...(failedBlocks.length > 0 && { failedBlocks })
        });
    } catch (e: any) {
        console.error('[Claim] Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
