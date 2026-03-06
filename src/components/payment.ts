import { state } from './state';
import { requestProvider } from 'webln';
import { updateUI } from '../main';
import { submitBet } from '../utils/ledger';
import { authState } from './auth';

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

    btn.classList.add('success-glow');
    btn.innerHTML = `<span style="font-size:0.9rem">Firmando...</span>`;

    try {
        const paymentRequest = await submitBet(state.targetBlock, state.selectedNumber);

        // At this point, the bet is already in Neon DB
        await updateUI();

        btn.innerHTML = `<span style="font-size:0.9rem">Aprobá pago</span>`;
        const webln = await requestProvider();
        await webln.sendPayment(paymentRequest);

        btn.innerHTML = `PAGO APROBADO`;
        document.body.classList.add('flash-green');
    } catch {
        btn.classList.remove('success-glow');
        btn.classList.add('error-glow');
        document.querySelector('.number-segment.selected')?.classList.add('error-selected');
        btn.innerHTML = `<span style="font-size:2rem">❌</span>`;
        document.body.classList.remove('flash-green');
    } finally {
        setTimeout(resetBtn, 4000);
    }
}
