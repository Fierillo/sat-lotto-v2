export function showFrozenHelpModal(): void {
    const existingModal = document.getElementById('frozenHelpModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'frozenHelpModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
        <div class="modal auth-modal" style="max-width: 400px; text-align: left;">
            <h2 style="color: var(--neon-blue); text-shadow: 0 0 10px rgba(0, 242, 255, 0.98);">Fase de Bloqueo</h2>
            <div style="font-size: 0.9rem; line-height: 1.6; color: #ccc; margin: 20px 0;">
                <p>El juego entra en <strong>Fase Frozen</strong> durante los últimos 2 bloques antes del sorteo.</p>
                <p>Esta medida de seguridad garantiza que:</p>
                <ul style="padding-left: 20px; color: #aaa;">
                    <li>No se realicen apuestas cuando el resultado está por ser revelado.</li>
                    <li>Se eviten problemas de propagación en la red (mempool) al final del ciclo.</li>
                    <li>El sorteo sea totalmente <strong>justo y transparente</strong> para todos.</li>
                </ul>
                <p style="margin-top: 15px; color: var(--neon-orange);">¡Tu apuesta es válida para el bloque target informado!</p>
            </div>
            <button class="close-btn" id="closeFrozenModal" style="width: 100%; margin-top: 10px;">Entendido</button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelector('#closeFrozenModal')?.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}
