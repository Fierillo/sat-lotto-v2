import { state } from './state';
import { createNwcInvoice } from '../utils/create-invoice';
import { requestProvider } from 'webln';

export async function makePayment(): Promise<void> {
    if (state.selectedNumber === null) return;

    const btn = document.querySelector('.pay-btn') as HTMLButtonElement;
    if (!btn) return;

    const resetBtn = (): void => {
        btn.classList.remove('success-glow', 'error-glow');
        btn.innerHTML = 'JUGAR';
        btn.disabled = false;
    };

    const nwcUrl = import.meta.env.VITE_NWC_URL;
    if (!nwcUrl) {
        btn.classList.add('error-glow');
        btn.innerHTML = `<span style="font-size:0.9rem">NO NWC</span>`;
        setTimeout(resetBtn, 4000);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span style="font-size:1.1rem;color:#f7931a">21<br>SATS</span>`;

    try {
        const invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto - Bloque ${state.targetBlock} - Num ${state.selectedNumber}`);
        btn.innerHTML = `<span style="font-size:0.9rem">PAGA<br>WEBLN</span>`;

        const webln = await requestProvider();
        const pr = (invoice as any).invoice || (invoice as any).paymentRequest;
        await webln.sendPayment(pr);

        btn.classList.add('success-glow');
        btn.innerHTML = `<span style="font-size:2rem">✅</span>`;
    } catch {
        btn.classList.add('error-glow');
        btn.innerHTML = `<span style="font-size:2rem">❌</span>`;
    } finally {
        setTimeout(resetBtn, 4000);
    }
}
