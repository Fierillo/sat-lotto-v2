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

export function showTransparencyHelpModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal auth-modal" style="max-width: 400px; text-align: left;">
            <h2 style="color: var(--neon-orange); text-shadow: 0 0 10px rgba(247, 147, 26, 0.5);">Transparencia del Pozo</h2>
            <div style="font-size: 0.9rem; line-height: 1.6; color: #ccc; margin: 20px 0;">
                <p>¿Por que si mande 21 sats, el pozo suma menos?</p>
                <p>Los <strong>2 sats restantes</strong> son la comisión para seguir dándole amor al código.</p>
            </div>
            <button class="close-btn" id="closeTransModal" style="width: 100%;">Entendido</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeTransModal')?.addEventListener('click', () => modal.remove());
}

export function showPotentialWinnerModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.style.display = 'flex';
    
    const currentLud16 = localStorage.getItem('satlotto_lud16') || '';

    modal.innerHTML = `
        <div class="modal auth-modal" style="max-width: 400px; text-align: center;">
            <h2 style="color: var(--neon-green); text-shadow: 0 0 15px rgba(0, 255, 157, 0.5);">EL AZAR TE HA ELEGIDO... 🏆</h2>
            <div style="font-size: 0.95rem; line-height: 1.6; color: #ccc; margin: 20px 0;">
                <p>Las estrellas se están alineando en la red Bitcoin. Estamos esperando <strong>2 confirmaciones</strong> para sellar tu destino.</p>
                <p>Algo grande está por suceder. Asegurate de que tengamos dónde enviarte el botín:</p>
                
                <div style="margin-top: 20px; text-align: left;">
                    <label style="font-size: 0.75rem; color: var(--neon-orange); text-transform: uppercase;">Tu Lightning Address:</label>
                    <input type="text" id="lud16Input" value="${currentLud16}" placeholder="usuario@dominio.com" 
                        style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; border-radius: 4px; margin-top: 5px; outline: none; font-family: inherit;">
                    <p id="claimStatus" style="font-size: 0.7rem; margin-top: 5px; color: var(--neon-green); opacity: 0; transition: opacity 0.3s; font-weight: bold;">¡Dirección guardada! ⚡</p>
                </div>
            </div>
            <button class="close-btn" id="closePotModal" style="width: 100%;">Mantenerme a la espera</button>
        </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#lud16Input') as HTMLInputElement;
    const status = modal.querySelector('#claimStatus') as HTMLElement;

    input.addEventListener('change', async () => {
        const val = input.value.trim();
        if (val.includes('@')) {
            localStorage.setItem('satlotto_lud16', val);
            status.style.opacity = '1';
            
            // Sincronizar con el servidor "bajo tierra"
            const { authState } = await import('../auth/auth-state');
            if (authState.loginEvent) {
                fetch('/api/identity/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        event: authState.loginEvent, 
                        lud16: val 
                    })
                }).catch(() => {});
            }
            
            setTimeout(() => { status.style.opacity = '0'; }, 3000);
        }
    });

    modal.querySelector('#closePotModal')?.addEventListener('click', () => modal.remove());
}
