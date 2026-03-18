import { state } from '../app-state';
import { updateUI } from '../main';
import { authState, logRemote } from './auth';
import { fetchGameState } from './game';
import { apiClient } from './api-client';
import ndk, { getAlias } from './nostr-service';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { finalizeEvent } from 'nostr-tools';
import { NIP07 } from '../lib/nip07';
import { NWC } from '../lib/nwc';
import { showInvoiceModal } from '../ui/invoice-modal';
import { fitText } from './text-fit';
import type { Bet, UnsignedEvent, SignedEvent, BetResponse } from '../types';

// ─── Bet Signing ────────────────────────────────────────────────────

export async function submitBet(targetBlock: number, selectedNumber: number): Promise<{ paymentRequest: string; paymentHash: string } | null> {
    if (!authState.pubkey) throw new Error('No estás logueado');

    const unsigned = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({
            bloque: targetBlock,
            numero: selectedNumber,
            alias: authState.nip05 || getAlias(authState.pubkey)
        }),
        pubkey: authState.pubkey
    };

    let signed: SignedEvent | null = null;
    const ext = window.nostr;

    if (authState.signer) {
        try {
            const ev = new NDKEvent(ndk, unsigned);
            console.log('[submitBet] Firmar con signer...');

            const signPromise = ev.sign(authState.signer);
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout esperando firma')), 15000));
            const signature = await Promise.race([signPromise, timeout]);

            ev.sig = signature;
            signed = ev.rawEvent();

            if (!signed.sig) throw new Error('Firma vacía');
            console.log('[submitBet] Firmado OK, id:', signed.id?.substring(0, 12));
        } catch (e: any) {
            console.error('[submitBet] Signer falló:', e.message || e);
        }
    }

    if (!signed && ext) {
        try {
            console.log('[submitBet] Fallback: extensión...');
            signed = await ext.signEvent(unsigned);
            console.log('[submitBet] Ext firmada OK, id:', signed!.id?.substring(0, 12));
        } catch (e) {
            console.error('[submitBet] Ext falló:', e);
        }
    }

    if (!signed && authState.nwcUrl) {
        try {
            const url = new URL(authState.nwcUrl.replace('nostr+walletconnect:', 'http:'));
            const secret = url.searchParams.get('secret');
            if (secret) {
                console.log('[submitBet] Fallback: NWC secret...');
                const bytes = Uint8Array.from(secret.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                signed = finalizeEvent(unsigned, bytes);
                console.log('[submitBet] NWC firmada OK, id:', signed.id?.substring(0, 12));
            }
        } catch (e) {
            console.error('[submitBet] NWC falló:', e);
        }
    }

    if (!signed) throw new Error('No se pudo firmar. Verificá tu conexión.');

    const payload = { signedEvent: signed };
    return apiClient.post<{ paymentRequest: string; paymentHash: string }>('/api/bet', payload);
}

export const confirmBet = (paymentHash: string) => apiClient.post('/api/bet', { paymentHash, action: 'confirm' });

// ─── Number Change Modal ────────────────────────────────────────────

async function showConfirmModal(oldLuckNumber: number, newLuckNumber: number): Promise<boolean> {
    return new Promise((resolve) => {
        const confirmModalContainer = document.createElement('div');
        confirmModalContainer.className = 'modal-bg';
        confirmModalContainer.style.display = 'flex';
        confirmModalContainer.innerHTML = `
            <div class="modal">
                <h2 style="color:#f7931a">¿Cambiar apuesta?</h2>
                <p style="margin-bottom:20px; color:rgba(255,255,255,0.7)">
                    Ya tienes una apuesta al <strong class="text-green">${oldLuckNumber}</strong>.<br><br>
                    Si continúas, la cambiaremos por el <strong class="text-orange">${newLuckNumber}</strong>.<br>
                    <small>(Deberás pagar un nuevo ticket)</small>
                </p>
                <button class="auth-btn" id="confirmChange">CAMBIAR</button>
                <button class="close-btn" id="cancelChange" style="margin-top:10px">Cancelar</button>
            </div>
        `;
        document.body.appendChild(confirmModalContainer);

        confirmModalContainer.querySelector('#confirmChange')?.addEventListener('click', () => {
            confirmModalContainer.remove();
            resolve(true);
        });
        confirmModalContainer.querySelector('#cancelChange')?.addEventListener('click', () => {
            confirmModalContainer.remove();
            resolve(false);
        });
    });
}

// ─── Payment Orchestration ──────────────────────────────────────────

export async function makePayment(): Promise<void> {
    logRemote({ msg: 'MAKE_PAYMENT', loginMethod: authState.loginMethod, nwcUrl: !!authState.nwcUrl,         hasWebln: !!window.webln });

    if (state.selectedNumber === null) return;
    const centralPayButton = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!centralPayButton) return;

    const resetInteractionStatus = (): void => {
        centralPayButton.classList.remove('success-glow', 'error-glow', 'blink-purple');
        document.body.classList.remove('flash-green', 'processing');
        if (typeof window.updateCenterButton === 'function') window.updateCenterButton();
    };

    if (!authState.pubkey) {
        centralPayButton.classList.add('error-glow');
        fitText(centralPayButton, 'Login');
        setTimeout(resetInteractionStatus, 5000);
        return;
    }

    const { activeBets, block } = await fetchGameState();
    state.targetBlock = block.target;

    const existingBetFromUser = activeBets.find((bet: Bet) =>
        bet.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
    );

    if (existingBetFromUser && Number(existingBetFromUser.selected_number) !== state.selectedNumber) {
        const userConfirmsChange = await showConfirmModal(existingBetFromUser.selected_number, state.selectedNumber);
        if (!userConfirmsChange) return;
    }

    document.body.classList.add('processing');
    centralPayButton.classList.add('success-glow');

    if (authState.loginMethod === 'amber') {
        centralPayButton.innerHTML = `<span style="font-size:0.9rem">Generando invoice...</span>`;

        try {
            const result = await fetch(`/api/bet?block=${state.targetBlock}&number=${state.selectedNumber}&pubkey=${authState.pubkey}`);
            if (!result.ok) throw new Error('No se pudo generar la invoice');
            const { paymentRequest, paymentHash } = await result.json();

            const handleSuccessfulPayment = async () => {
                await confirmBet(paymentHash);
                await updateUI();
                centralPayButton.innerHTML = `<span style="font-size:1rem">PAGO APROBADO</span>`;
                document.body.classList.add('flash-green');
                setTimeout(resetInteractionStatus, 4000);
            };

            showInvoiceModal(paymentRequest, handleSuccessfulPayment, resetInteractionStatus);
            return;
        } catch (e: any) {
            console.error('[makePayment] Amber invoice failed:', e);
            centralPayButton.classList.remove('success-glow');
            centralPayButton.classList.add('error-glow');
            fitText(centralPayButton, 'Error');
            setTimeout(resetInteractionStatus, 5000);
            return;
        }
    }

    centralPayButton.innerHTML = `<span style="font-size:0.9rem">Firmando...</span>`;

    try {
        console.log('[makePayment] Requesting signed bet & invoice...');
        const result = await submitBet(state.targetBlock, state.selectedNumber);
        if (!result) throw new Error('No response from server');

        const { paymentRequest, paymentHash } = result;

        const handleSuccessfulPayment = async () => {
            console.log('[makePayment] Payment detected, confirming with server...');
            await confirmBet(paymentHash);
            await updateUI();
            centralPayButton.innerHTML = `<span style="font-size:1rem">PAGO APROBADO</span>`;
            document.body.classList.add('flash-green');
            setTimeout(resetInteractionStatus, 4000);
        };

        if (authState.nwcUrl) {
            console.log('[makePayment] Flow: NWC Direct Pay');
            centralPayButton.innerHTML = `<span style="font-size:0.9rem">Pagando NWC...</span>`;
            await NWC.payInvoice(paymentRequest);
            await handleSuccessfulPayment();
            return;
        }

        if (NIP07.canPay) {
            console.log('[makePayment] Flow: Extension WebLN');
            try {
                centralPayButton.innerHTML = `<span style="font-size:0.9rem">Confirmá en Alby</span>`;
                await NIP07.payInvoice(paymentRequest);
                await handleSuccessfulPayment();
                return;
            } catch (err) {
                console.warn('[makePayment] WebLN failed/canceled, falling back to modal');
            }
        }

        console.log('[makePayment] Flow: Manual Invoice Modal');
        showInvoiceModal(paymentRequest, handleSuccessfulPayment, resetInteractionStatus);

    } catch (paymentError: any) {
        console.error('[makePayment] Final catch:', paymentError);
        centralPayButton.classList.remove('success-glow');
        centralPayButton.classList.add('error-glow');

        const errorMsg = paymentError.message?.includes('Rate limit') ? 'Rate limit' : 'Error servidor';
        fitText(centralPayButton, errorMsg);
        setTimeout(resetInteractionStatus, 5000);
    }
}
