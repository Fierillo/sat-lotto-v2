import { state } from './app-state';
import { requestProvider } from 'webln';
import { updateUI } from './main';
import { submitBet, confirmBet, fetchGameState } from './utils/game-api';
import { authState } from './auth/auth-state';
import { payNwcInvoice } from './utils/pay-invoice';
import { showInvoiceModal } from './ui/invoice-modal';

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
    if (state.selectedNumber === null) return;
    const centralPayButton = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!centralPayButton) return;

    const resetInteractionStatus = (): void => {
        centralPayButton.classList.remove('success-glow', 'error-glow', 'blink-purple');
        document.body.classList.remove('flash-green', 'processing');
        if (typeof (window as any).updateCenterButton === 'function') (window as any).updateCenterButton();
    };

    if (!authState.pubkey) {
        centralPayButton.classList.add('error-glow');
        centralPayButton.innerHTML = `<span style="font-size:0.9rem">Login<br>Antes</span>`;
        setTimeout(resetInteractionStatus, 5000);
        return;
    }

    // 1. Force state refresh to avoid race conditions (detect confirmed bets from seconds ago)
    const { activeBets } = await fetchGameState();
    const existingBetFromUser = activeBets.find((bet: any) => 
        bet.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
    );

    if (existingBetFromUser && Number(existingBetFromUser.selected_number) !== state.selectedNumber) {
        const userConfirmsChange = await showConfirmModal(existingBetFromUser.selected_number, state.selectedNumber);
        if (!userConfirmsChange) return;
    }

    document.body.classList.add('processing');
    centralPayButton.classList.add('success-glow');
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

        // 2. Streamlined Payment Waterfall
        
        // Priority A: NWC (Auto-Pay)
        if (authState.nwcUrl) {
            console.log('[makePayment] Flow: NWC Direct Pay');
            centralPayButton.innerHTML = `<span style="font-size:0.9rem">Pagando NWC...</span>`;
            await payNwcInvoice(authState.nwcUrl, paymentRequest);
            await handleSuccessfulPayment();
            return;
        }

        // Priority B: WebLN / Alby Extension
        if ((window as any).webln) {
            console.log('[makePayment] Flow: WebLN Extension');
            try {
                const weblnProvider = await requestProvider();
                centralPayButton.innerHTML = `<span style="font-size:0.9rem">Confirmá en Alby</span>`;
                await weblnProvider.sendPayment(paymentRequest);
                await handleSuccessfulPayment();
                return;
            } catch (err) {
                console.warn('[makePayment] WebLN failed/canceled, falling back to modal');
            }
        }

        // Priority C: Manual Invoice (Nos2x, Bunker, No extension)
        console.log('[makePayment] Flow: Manual Invoice Modal');
        showInvoiceModal(paymentRequest, handleSuccessfulPayment, resetInteractionStatus);

    } catch (paymentError: any) {
        console.error('[makePayment] Final catch:', paymentError);
        centralPayButton.classList.remove('success-glow');
        centralPayButton.classList.add('error-glow');
        centralPayButton.innerHTML = `<span style="font-size:0.8rem">${paymentError.message || 'Error'}</span>`;
        setTimeout(resetInteractionStatus, 5000);
    }
}
