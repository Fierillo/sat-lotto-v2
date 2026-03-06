import { state } from './state';
import { createNwcInvoice } from '../utils/create-invoice';
import { requestProvider } from 'webln';

export async function makePayment(): Promise<void> {
    if (state.selectedNumber === null) return;

    const status = document.getElementById('paymentStatus') as HTMLElement;
    if (!status) return;

    const nwcUrl = import.meta.env.VITE_NWC_URL;
    if (!nwcUrl) {
        status.style.display = 'block';
        status.textContent = "Error: Falta configurar VITE_NWC_URL";
        return;
    }

    status.style.display = 'block';
    status.classList.remove('success');
    status.textContent = "Generando invoice de 21 sats...";

    try {
        const invoice = await createNwcInvoice(nwcUrl, 21, `SatLotto - Bloque ${state.targetBlock} - Número ${state.selectedNumber}`);

        status.textContent = "Esperando pago via WebLN...";

        const webln = await requestProvider();
        const pr = (invoice as any).invoice || (invoice as any).paymentRequest;
        const response = await webln.sendPayment(pr);

        status.classList.add('success');
        status.innerHTML = `✅ Pago exitoso<br>Preimage: <code>${response.preimage.slice(0, 16)}...</code>`;
    } catch (error: any) {
        status.textContent = `❌ Error: ${error.message || 'No se pudo completar el pago'}`;
    }
}
