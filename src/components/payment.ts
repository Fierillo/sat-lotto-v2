import { state } from './state';
import { createNwcInvoice } from '../utils/create-invoice';
import { requestProvider } from 'webln';
import { saveBet } from '../utils/ledger';

export async function makePayment(): Promise<void> {
    if (state.selectedNumber === null) return;

    const btn = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!btn) return;

    const resetBtn = (): void => {
        btn.classList.remove('success-glow', 'error-glow');
        document.body.classList.remove('flash-green');
        btn.innerHTML = 'JUGAR';
    };

    const nwcUrl = import.meta.env.VITE_NWC_URL;
    if (!nwcUrl) {
        btn.classList.add('error-glow');
        btn.innerHTML = `<span style="font-size:0.9rem">NO NWC</span>`;
        setTimeout(resetBtn, 4000);
        return;
    }

    btn.classList.add('success-glow');
    btn.innerHTML = `<span style="font-size:0.9rem">Cargando...</span>`;

    try {
        const invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto - Bloque ${state.targetBlock} - Num ${state.selectedNumber}`);
        btn.innerHTML = `<span style="font-size:0.9rem">Aprobá pago</span>`;

        const webln = await requestProvider();
        const pr = (invoice as any).invoice || (invoice as any).paymentRequest;
        await webln.sendPayment(pr);

        btn.innerHTML = `ÉXITO`;
        document.body.classList.add('flash-green');

        await saveBet(state.targetBlock, state.selectedNumber);
    } catch {
        btn.classList.remove('success-glow');
        btn.classList.add('error-glow');
        btn.innerHTML = `<span style="font-size:2rem">❌</span>`;
        document.body.classList.remove('flash-green');
    } finally {
        setTimeout(resetBtn, 4000);
    }
}
