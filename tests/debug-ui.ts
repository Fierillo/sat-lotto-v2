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

    // Botón Flash Verde
    const testBtn = document.createElement('button');
    testBtn.style.cssText = btnStyle + 'border:1px solid #00ff9d; color:#00ff9d;';
    testBtn.textContent = '⚡ TEST FLASH';
    testBtn.onclick = () => {
        document.body.classList.add('flash-green');
        setTimeout(() => document.body.classList.remove('flash-green'), 3000);
    };

    // Botón Victoria Naranja
    const vicBtn = document.createElement('button');
    vicBtn.style.cssText = btnStyle + 'border:1px solid #f7931a; color:#f7931a;';
    vicBtn.textContent = '🏆 TEST VICTORY';
    vicBtn.onclick = () => {
        const clock = document.getElementById('clock');
        if (clock) {
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
                clock.classList.remove('victory-mode');
                document.body.classList.remove('celebrating');
                overlay.remove();
                msg.remove();
            }, 4500);
        }
    };

    // Botón Frozen Azul
    const frozenBtn = document.createElement('button');
    frozenBtn.style.cssText = btnStyle + 'border:1px solid #00f2ff; color:#00f2ff;';
    frozenBtn.textContent = '❄️ TEST FROZEN';
    frozenBtn.onclick = () => {
        document.body.classList.toggle('phase-frozen');
    };

    container.appendChild(testBtn);
    container.appendChild(vicBtn);
    container.appendChild(frozenBtn);
    document.body.appendChild(container);
}
