import { state } from './state';
import { requestProvider } from 'webln';
import { updateUI } from '../main';
import { submitBet, fetchBets } from '../utils/ledger';
import { authState } from './auth';

async function showConfirmModal(oldNum: number, newNum: number): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-bg';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal">
                <h2 style="color:#f7931a">¿Cambiar apuesta?</h2>
                <p style="margin-bottom:20px; color:rgba(255,255,255,0.7)">
                    Ya tienes una apuesta al <strong class="text-green">${oldNum}</strong>.<br><br>
                    Si continúas, la cambiaremos por el <strong class="text-orange">${newNum}</strong>.<br>
                    <small>(Deberás pagar un nuevo ticket)</small>
                </p>
                <button class="auth-btn" id="confirmChange" style="background:rgba(0,255,157,0.2); border-color:#00ff9d; color:#00ff9d">CAMBIAR</button>
                <button class="close-btn" id="cancelChange" style="margin-top:10px">Cancelar</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#confirmChange')?.addEventListener('click', () => {
            modal.remove();
            resolve(true);
        });
        modal.querySelector('#cancelChange')?.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
    });
}

export async function makePayment(): Promise<void> {
    if (state.selectedNumber === null) return;

    const btn = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!btn) return;

    const resetBtn = (): void => {
        btn.classList.remove('success-glow', 'error-glow');
        document.body.classList.remove('flash-green');
        document.querySelector('.number-segment.selected')?.classList.remove('error-selected');
        btn.innerHTML = 'JUGAR';
    };

    if (!authState.pubkey) {
        btn.classList.add('error-glow');
        document.querySelector('.number-segment.selected')?.classList.add('error-selected');
        btn.innerHTML = `<span style="font-size:0.9rem">Login<br>Antes</span>`;
        setTimeout(resetBtn, 4000);
        return;
    }

    // Check if user already has a bet
    const bets = await fetchBets(state.targetBlock);
    const existingBet = bets.find(b => b.pubkey === authState.pubkey);

    if (existingBet && existingBet.selected_number !== state.selectedNumber) {
        const confirmed = await showConfirmModal(existingBet.selected_number, state.selectedNumber);
        if (!confirmed) return;
    }

    btn.classList.add('success-glow');
    btn.innerHTML = `<span style="font-size:0.9rem">Firmando...</span>`;

    try {
        const paymentRequest = await submitBet(state.targetBlock, state.selectedNumber);
        await updateUI();

        btn.innerHTML = `<span style="font-size:0.9rem">Aprobá pago</span>`;
        const webln = await requestProvider();
        await webln.sendPayment(paymentRequest);

        btn.innerHTML = `<span style="font-size:1rem">PAGO APROBADO</span>`;
        document.body.classList.add('flash-green');
    } catch (e: any) {
        btn.classList.remove('success-glow');
        btn.classList.add('error-glow');
        document.querySelector('.number-segment.selected')?.classList.add('error-selected');
        btn.innerHTML = `<span style="font-size:0.8rem">${e.message || '❌'}</span>`;
        document.body.classList.remove('flash-green');
    } finally {
        setTimeout(resetBtn, 4000);
    }
}
