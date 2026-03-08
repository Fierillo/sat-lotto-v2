export function showInvoiceModal(bolt11PaymentRequest: string, handleSuccessfulPayment: () => void, handleCancelInteraction?: () => void): void {
    const handleCloseModal = () => {
        if (handleCancelInteraction) handleCancelInteraction();
        invoiceModalContainer.remove();
    };

    const handleCopyInvoiceToClipboard = async () => {
        const showStatus = () => {
            const statusNotification = document.getElementById('prStatus');
            if (statusNotification) {
                statusNotification.style.opacity = '1';
                setTimeout(() => { if (statusNotification) statusNotification.style.opacity = '0'; }, 2000);
            }
        };

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(bolt11PaymentRequest);
                showStatus();
            } else {
                throw new Error('Clipboard API unavailable');
            }
        } catch (copyError) {
            const fallbackTextArea = document.createElement("textarea");
            fallbackTextArea.value = bolt11PaymentRequest;
            fallbackTextArea.style.position = "fixed";
            fallbackTextArea.style.left = "-9999px";
            fallbackTextArea.style.top = "0";
            document.body.appendChild(fallbackTextArea);
            fallbackTextArea.focus();
            fallbackTextArea.select();
            try {
                document.execCommand('copy');
                showStatus();
            } catch (e) {
                console.error('Fallback copy failed', e);
            }
            document.body.removeChild(fallbackTextArea);
        }
    };

    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(bolt11PaymentRequest)}`;

    const invoiceModalContainer = document.createElement('div');
    invoiceModalContainer.className = 'modal-bg';
    invoiceModalContainer.style.display = 'flex';
    invoiceModalContainer.innerHTML = `
        <div class="modal invoice-modal" style="max-width: 420px; text-align: center; border: 1px solid rgba(247, 147, 26, 0.3)">
            <h2 style="color: var(--neon-orange); margin-bottom: 5px; font-size: 1.4rem">Escaneá y Jugá</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 20px; line-height: 1.4">
                La extensión no permite pagos directos.<br />
                Confirmá tu apuesta escaneando el QR.
            </p>
            
            <div class="qr-container" style="display: flex; justify-content: center; margin-bottom: 25px">
                <div style="background: white; padding: 12px; border-radius: 12px; box-shadow: 0 0 30px rgba(247, 147, 26, 0.3)">
                    <img src="${qrCodeImageUrl}" alt="QR Invoice" style="width: 220px; height: 220px; display: block" />
                </div>
            </div>

            <div style="text-align: left; margin-bottom: 25px">
                <label style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px">Bolt11 Invoice:</label>
                <div id="copyPr" class="copy-target" style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 0.72rem; word-break: break-all; margin-top: 5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); color: var(--neon-green); position: relative; transition: all 0.2s; -webkit-tap-highlight-color: transparent; user-select: all">
                    ${bolt11PaymentRequest.slice(0, 50)}...${bolt11PaymentRequest.slice(-20)}
                    <div id="prStatus" style="position: absolute; left: 50%; transform: translateX(-50%); bottom: -22px; font-size: 0.65rem; color: var(--neon-green); opacity: 0; transition: opacity 0.3s; white-space: nowrap; pointer-events: none">¡Invoice Copiado! ⚡</div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; align-items: center">
                <div id="paymentStatus" style="font-size: 0.9rem; color: var(--neon-orange); font-weight: bold; display: flex; align-items: center; gap: 8px">
                    <span class="status-dot"></span> Esperando pago...
                </div>
                <button class="close-btn" id="closeInvoice" style="font-size: 0.85rem; opacity: 0.6">Cancelar Apuesta</button>
            </div>
        </div>
    `;

    invoiceModalContainer.querySelector('#copyPr')?.addEventListener('click', () => handleCopyInvoiceToClipboard());
    invoiceModalContainer.querySelector('#closeInvoice')?.addEventListener('click', () => handleCloseModal());

    document.body.appendChild(invoiceModalContainer);

    const paymentPollingInterval = setInterval(async () => {
        try {
            await handleSuccessfulPayment();
            clearInterval(paymentPollingInterval);
            invoiceModalContainer.remove();
        } catch { /* waiting for payment */ }
    }, 2500);

    const modalMutationObserver = new MutationObserver(() => {
        if (!document.body.contains(invoiceModalContainer)) {
            clearInterval(paymentPollingInterval);
            modalMutationObserver.disconnect();
        }
    });
    modalMutationObserver.observe(document.body, { childList: true });
}
