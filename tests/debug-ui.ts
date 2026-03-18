import { showPotentialWinnerModal } from '../src/ui/help-modals';
import { state } from '../src/app-state';
import { renderChampionsTable } from '../src/ui/champions-table';

export function injectDebugButtons(): void {
    if (document.getElementById('debug-container')) return;

    const container = document.createElement('div');
    container.id = 'debug-container';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 9999;
    `;

    const btnStyle = 'font-size:0.7rem; padding:6px 12px; background:rgba(0,0,0,0.8); border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s;';

    // Helper para resetear estados antes de un nuevo test
    const resetStates = () => {
        document.body.classList.remove('phase-frozen', 'phase-resolving', 'flash-green', 'celebrating');
        const clock = document.getElementById('clock');
        if (clock) clock.classList.remove('victory-mode');
        const btn = document.getElementById('centerBtn') as HTMLButtonElement;
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('frozen');
            btn.innerHTML = 'APOSTAR';
        }
    };

    // 1. Botón Flash Verde (Pago)
    const testBtn = document.createElement('button');
    testBtn.style.cssText = btnStyle + 'border:1px solid #00ff9d; color:#00ff9d;';
    testBtn.textContent = '⚡ TEST FLASH';
    testBtn.onclick = () => {
        resetStates();
        const btn = document.getElementById('centerBtn') as HTMLButtonElement;
        if (btn) {
            btn.innerHTML = '¡PAGADO!';
            btn.disabled = true; // Simular bloqueo durante el proceso
            document.body.classList.add('flash-green');
            setTimeout(resetStates, 3000);
        }
    };

    // 2. Botón Frozen Azul (Veda)
    const frozenBtn = document.createElement('button');
    frozenBtn.style.cssText = btnStyle + 'border:1px solid #00f2ff; color:#00f2ff;';
    frozenBtn.textContent = '❄️ TEST FROZEN';
    frozenBtn.onclick = () => {
        const wasFrozen = document.body.classList.contains('phase-frozen');
        resetStates();
        if (!wasFrozen) {
            document.body.classList.add('phase-frozen');
            const btn = document.getElementById('centerBtn') as HTMLButtonElement;
            if (btn) {
                btn.innerHTML = `<span>NO PODÉS<br>APOSTAR</span>`;
                btn.classList.add('frozen');
                btn.disabled = true;
            }
        }
    };

    // 3. Botón Resolving Naranja (Fin de Ronda)
    const resBtn = document.createElement('button');
    resBtn.style.cssText = btnStyle + 'border:1px solid #f7931a; color:#f7931a;';
    resBtn.textContent = '🔥 TEST RESOLVING';
    resBtn.onclick = () => {
        const wasRes = document.body.classList.contains('phase-resolving');
        resetStates();
        if (!wasRes) {
            document.body.classList.add('phase-resolving');
            const btn = document.getElementById('centerBtn') as HTMLButtonElement;
            if (btn) {
                btn.innerHTML = `<span>FIN DE<br>RONDA</span>`;
                btn.classList.add('frozen');
                btn.disabled = true;
            }
        }
    };

    // 4. Botón Victoria Naranja (Campeón)
    const vicBtn = document.createElement('button');
    vicBtn.style.cssText = btnStyle + 'border:1px solid #f7931a; color:#f7931a;';
    vicBtn.textContent = '🏆 TEST VICTORY';
    vicBtn.onclick = () => {
        resetStates();
        const clock = document.getElementById('clock');
        const btn = document.getElementById('centerBtn') as HTMLButtonElement;
        if (clock && btn) {
            btn.innerHTML = '¡GANASTE!';
            btn.disabled = true;
            clock.classList.add('victory-mode');
            document.body.classList.add('celebrating');
            
            const overlay = document.createElement('div');
            overlay.className = 'winner-overlay';
            document.body.appendChild(overlay);
            
            const msg = document.createElement('div');
            msg.className = 'victory-text-animation';
            msg.innerHTML = '¡CAMPEÓN!';
            document.body.appendChild(msg);

            if (!document.getElementById('victory-styles')) {
                const style = document.createElement('style');
                style.id = 'victory-styles';
                style.innerHTML = `
                    .victory-text-animation {
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        color: #fff; font-size: 5rem; font-weight: 900;
                        text-shadow: 0 0 30px #f7931a, 0 0 60px rgba(247, 147, 26, 0.5);
                        z-index: 10001; letter-spacing: 20px; text-transform: uppercase;
                        animation: winnerTextPop 4.2s forwards; white-space: nowrap; pointer-events: none;
                        font-family: 'JetBrains Mono', monospace;
                    }
                    @keyframes winnerTextPop {
                        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); filter: blur(10px); }
                        15% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); filter: blur(0); }
                        85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.3); filter: blur(20px); }
                    }
                `;
                document.head.appendChild(style);
            }

            setTimeout(() => {
                resetStates();
                overlay.remove();
                msg.remove();
            }, 4500);
        }
    };

    // 5. Botón Potencial Ganador (Corona)
    const potBtn = document.createElement('button');
    potBtn.style.cssText = btnStyle + 'border:1px solid #00ff9d; color:#00ff9d;';
    potBtn.textContent = '👑 TEST POTENTIAL';
    potBtn.onclick = () => {
        resetStates();
        showPotentialWinnerModal();
    };

    // 7. Test Champion List Switch (beautiful toggle)
    let testModeActive = false;
    const testPlayers = [
        { pubkey: '3a10e02580d9971de935cd940a5268bfe4589dfbcc7557375e708e4104973bb9', alias: 'Fierillo', sats_earned: 15000 },
        { pubkey: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234', alias: 'Satoshi', sats_earned: 8500 },
        { pubkey: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567', alias: 'Lightning', sats_earned: 12300 },
        { pubkey: 'c3d4e5f67890123456789012345678901234567890123456789012345678', alias: 'NostrFan', sats_earned: 4200 },
        { pubkey: 'd4e5f6789012345678901234567890123456789012345678901234567890', alias: 'BitcoinMaxi', sats_earned: 2100 },
    ];

    const switchContainer = document.createElement('div');
    switchContainer.style.cssText = 'display:flex; align-items:center; gap:10px;';

    const switchLabel = document.createElement('span');
    switchLabel.textContent = 'TEST CHAMPIONS';
    switchLabel.style.cssText = 'font-size:0.65rem; color:#888; font-weight:bold; letter-spacing:1px;';

    const toggleSwitch = document.createElement('button');
    toggleSwitch.style.cssText = `
        width: 50px;
        height: 26px;
        border-radius: 13px;
        border: 2px solid #ff00ff;
        background: linear-gradient(90deg, #333 50%, #ff00ff 50%);
        background-size: 200% 100%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
    `;
    toggleSwitch.onclick = () => {
        testModeActive = !testModeActive;
        console.log('TEST CHAMPIONS:', testModeActive ? 'ON' : 'OFF');

        if (testModeActive) {
            toggleSwitch.style.backgroundPosition = '100% 0';
            toggleSwitch.style.borderColor = '#00ff00';
            renderChampionsTable(testPlayers);
        } else {
            toggleSwitch.style.backgroundPosition = '0 0';
            toggleSwitch.style.borderColor = '#ff00ff';
            if ((window as any).updateUI) {
                (window as any).updateUI();
            }
        }
    };

    switchContainer.appendChild(switchLabel);
    switchContainer.appendChild(toggleSwitch);

    container.appendChild(testBtn);
    container.appendChild(vicBtn);
    container.appendChild(frozenBtn);
    container.appendChild(resBtn);
    container.appendChild(potBtn);
    container.appendChild(switchContainer);
    document.body.appendChild(container);
}
