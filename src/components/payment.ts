import { state } from './state';

export async function makePayment(): Promise<void> {
    if (state.selectedNumber === null) return;

    const status = document.getElementById('paymentStatus') as HTMLElement;
    if (!status) return;

    status.style.display = 'block';
    status.textContent = "Conectando con NWC...";

    await new Promise(r => setTimeout(r, 1000));

    status.classList.add('success');
    status.innerHTML = "<code>NWC MakeInvoice({amount:21000})</code>";
}
