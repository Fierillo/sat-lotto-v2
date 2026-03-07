export function showInvoiceModal(paymentRequest: string, onPaid: () => void): void {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.style.display = 'flex';

    // Simple QR API for premium look without bundling libs
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentRequest)}`;

    modal.innerHTML = `
        <div class="modal invoice-modal" style="max-width: 420px; text-align: center; border: 1px solid rgba(247, 147, 26, 0.3);">
            <h2 style="color: var(--neon-orange); margin-bottom: 10px; font-size: 1.4rem;">Pago Manual</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 20px; line-height: 1.4;">
                Tu extensión no permite pagos directos.<br>
                Escaneá con tu wallet para confirmar tu apuesta.
            </p>
            
            <div class="qr-container" style="display: flex; justify-content: center; margin-bottom: 20px;">
                <div style="background: white; padding: 12px; border-radius: 12px; box-shadow: 0 0 30px rgba(247, 147, 26, 0.3);">
                    <img src="${qrUrl}" alt="QR Invoice" style="width: 220px; height: 220px; display: block;" />
                </div>
            </div>

            <div style="text-align: left; margin-bottom: 25px;">
                <label style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">Bolt11 Invoice:</label>
                <div id="copyPr" style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 0.72rem; word-break: break-all; margin-top: 5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); color: var(--neon-green); position: relative;">
                    ${paymentRequest.slice(0, 50)}...${paymentRequest.slice(-20)}
                    <div id="prStatus" style="position: absolute; right: 10px; bottom: -20px; font-size: 0.6rem; color: var(--neon-green); opacity: 0; transition: opacity 0.3s;">¡Copiado!</div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                <button class="auth-btn" id="checkPayment" style="margin-bottom: 0; font-size: 0.95rem;">Verificar Pago</button>
                <button class="close-btn" id="closeInvoice">Cancelar</button>
            </div>
            
            <p style="font-size: 0.65rem; color: var(--text-dim); margin-top: 15px; font-style: italic; opacity: 0.7;">
                Esta ventana se cerrará automáticamente al detectar el pago.
            </p>
        </div>
    `;

    document.body.appendChild(modal);

    const checkPayment = async () => {
        const btn = document.getElementById('checkPayment') as HTMLButtonElement;
        if (!btn) return;

        const originalText = btn.textContent;
        btn.textContent = 'Verificando...';
        btn.disabled = true;

        try {
            await onPaid();
            modal.remove();
        } catch {
            btn.textContent = 'Aún sin pagar ⏳';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 2000);
        }
    };

    modal.querySelector('#copyPr')?.addEventListener('click', () => {
        navigator.clipboard.writeText(paymentRequest);
        const status = document.getElementById('prStatus');
        if (status) {
            status.style.opacity = '1';
            setTimeout(() => status.style.opacity = '0', 2000);
        }
    });

    modal.querySelector('#checkPayment')?.addEventListener('click', checkPayment);
    modal.querySelector('#closeInvoice')?.addEventListener('click', () => modal.remove());

    const poll = setInterval(async () => {
        try {
            await onPaid();
            clearInterval(poll);
            modal.remove();
        } catch { /* keep polling */ }
    }, 4000);

    const observer = new MutationObserver(() => {
        if (!document.body.contains(modal)) {
            clearInterval(poll);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });
}
