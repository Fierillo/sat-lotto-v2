import { state } from './app-state';
import { requestProvider } from 'webln';
import { updateUI } from './main';
import { createBetUnsigned, createBetSigned, confirmBet, fetchGameState } from './utils/game-api';
import { authState, logRemote } from './auth/auth-state';
import { payNwcInvoice } from './utils/pay-invoice';
import { showInvoiceModal } from './ui/invoice-modal';
import { fitText } from './utils/text-fit';

// Standalone PIN prompt — doesn't depend on login modal being in DOM

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

export async function makePayment(): Promise<void> {
    logRemote({ msg: 'MAKE_PAYMENT', loginMethod: authState.loginMethod, nwcUrl: !!authState.nwcUrl, hasWebln: !!(window as any).webln });
    
    if (state.selectedNumber === null) return;
    const centralPayButton = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!centralPayButton) return;

    const resetInteractionStatus = (): void => {
        centralPayButton.classList.remove('success-glow', 'error-glow', 'blink-purple');
        document.body.classList.remove('flash-green', 'processing');
        document.querySelector('.number-segment.selected')?.classList.remove('error-selected');
        if (typeof (window as any).updateCenterButton === 'function') (window as any).updateCenterButton();
    };

    if (!authState.pubkey) {
        centralPayButton.classList.add('error-glow');
        fitText(centralPayButton, 'Login');
        setTimeout(resetInteractionStatus, 5000);
        return;
    }

    // 1. Force state refresh to avoid race conditions (detect confirmed bets from seconds ago)
    const { activeBets, block } = await fetchGameState();
    state.targetBlock = block.target;
    
    const existingBetFromUser = activeBets.find((bet: any) => 
        bet.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
    );

    if (existingBetFromUser && Number(existingBetFromUser.selected_number) !== state.selectedNumber) {
        const userConfirmsChange = await showConfirmModal(existingBetFromUser.selected_number, state.selectedNumber);
        if (!userConfirmsChange) return;
    }

    document.body.classList.add('processing');
    centralPayButton.classList.add('success-glow');

    // SPECIAL CASE: Amber - obtener invoice SIN firma primero
    if (authState.loginMethod === 'amber') {
        centralPayButton.innerHTML = `<span style="font-size:0.9rem">Generando invoice...</span>`;
        
        try {
            const result = await fetch(`/api/bet?block=${state.targetBlock}&number=${state.selectedNumber}&pubkey=${authState.pubkey}`);
            if (!result.ok) { const err = await result.json().catch(() => ({})); throw new Error(err.error || 'Error ' + result.status); }
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

    // SPECIAL CASE: NWC — crear invoice sin firmar, auto-pagar con NWC
    if (authState.loginMethod === 'nwc' && authState.nwcUrl) {
        try {
            const result = await fetch(`/api/bet?block=${state.targetBlock}&number=${state.selectedNumber}&pubkey=${authState.pubkey}`);
            if (!result.ok) { const err = await result.json().catch(() => ({})); throw new Error(err.error || 'Error ' + result.status); }
            const { paymentRequest, paymentHash } = await result.json();

            centralPayButton.innerHTML = `<span style="font-size:0.9rem">Pagando con NWC...</span>`;
            await payNwcInvoice(authState.nwcUrl, paymentRequest);

            await confirmBet(paymentHash);
            await updateUI();
            centralPayButton.innerHTML = `<span style="font-size:1rem">PAGADO</span>`;
            document.body.classList.add('flash-green');
            setTimeout(resetInteractionStatus, 4000);
            return;
        } catch (e: any) {
            console.error('[makePayment] NWC flow failed:', e);
            centralPayButton.classList.remove('success-glow');
            centralPayButton.classList.add('error-glow');
            fitText(centralPayButton, 'Error');
            setTimeout(resetInteractionStatus, 5000);
            return;
        }
    }

    centralPayButton.innerHTML = `<span style="font-size:0.9rem">Firmando...</span>`;

    try {
        console.log('[makePayment] Creating signed bet...');
        
        const unsigned = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: state.targetBlock, numero: state.selectedNumber }),
            pubkey: authState.pubkey
        };

        // Firmar con el signer del authState (extensión o bunker)
        const { NDKEvent } = await import('@nostr-dev-kit/ndk');
        const { default: ndk } = await import('./utils/nostr-service');
        const ev = new NDKEvent(ndk, unsigned);
        await ev.sign(authState.signer);
        const signed = ev.rawEvent();

        const result = await createBetSigned(signed);
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

        // 2. Streamlined Payment Waterfall
        
        // Priority A: NWC (Auto-Pay)
        if (authState.nwcUrl) {
            console.log('[makePayment] Flow: NWC Direct Pay');
            centralPayButton.innerHTML = `<span style="font-size:0.9rem">Pagando NWC...</span>`;
            await payNwcInvoice(authState.nwcUrl, paymentRequest);
            await handleSuccessfulPayment();
            return;
        }

        // Priority B: WebLn / Alby Extension
        if ((window as any).webln) {
            console.log('[makePayment] Flow: WebLn Extension');
            try {
                const weblnProvider = await requestProvider();
                centralPayButton.innerHTML = `<span style="font-size:0.9rem">Confirmá en Alby</span>`;
                await weblnProvider.sendPayment(paymentRequest);
                await handleSuccessfulPayment();
                return;
            } catch (err) {
                console.warn('[makePayment] WebLn failed/canceled, falling back to modal');
            }
        }

        // Priority C: Manual Invoice (Nos2x, Bunker, No extension)
        console.log('[makePayment] Flow: Manual Invoice Modal');
        showInvoiceModal(paymentRequest, handleSuccessfulPayment, resetInteractionStatus);

    } catch (paymentError: any) {
        console.error('[makePayment] Final catch:', paymentError);
        centralPayButton.classList.remove('success-glow');
        centralPayButton.classList.add('error-glow');

        const isRateLimit = paymentError.message?.includes('Rate limit');
        const errorMsg = isRateLimit ? 'Rate limit' : 'Error servidor';
        fitText(centralPayButton, errorMsg);

        if (isRateLimit) {
            document.querySelector('.number-segment.selected')?.classList.add('error-selected');
        }

        setTimeout(resetInteractionStatus, 5000);
    }
}
