import { resolveName } from './utils/nostr-service';
import { copyToClipboard } from './utils/clipboard-utils';
import { state } from './app-state';
import { authState } from './auth/auth-state';

async function triggerVictoryCelebration(_winningNumber: number, blockHeight: number): Promise<void> {
    const clock = document.getElementById('clock');
    if (!clock) return;

    // 1. Sincronizar victoria "Bajo Tierra" (usando el pasaporte del login)
    if (authState.loginEvent) {
        try {
            await fetch('/api/identity/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    event: authState.loginEvent, 
                    blockHeight 
                })
            });
        } catch (e) {
            console.error('[Celebration] Sync failed:', e);
        }
    }

    // 2. Iniciar animación del reloj y el cuerpo
    clock.classList.add('victory-mode');
    document.body.classList.add('celebrating');
    
    // 3. Overlay de resplandor
    const overlay = document.createElement('div');
    overlay.className = 'winner-overlay';
    document.body.appendChild(overlay);

    // 4. Mostrar mensaje épico flotante (¡CAMPEÓN!)
    const msg = document.createElement('div');
    msg.className = 'victory-text-animation';
    msg.innerHTML = '¡CAMPEÓN!';
    document.body.appendChild(msg);

    // Asegurar que los estilos existan
    if (!document.getElementById('victory-styles')) {
        const style = document.createElement('style');
        style.id = 'victory-styles';
        style.innerHTML = `
            .victory-text-animation {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                color: #fff; font-size: 5rem; font-weight: 900;
                text-shadow: 0 0 40px #f7931a, 0 0 80px #f7931a;
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

    // Limpieza después de 4.2s
    setTimeout(() => {
        clock.classList.remove('victory-mode');
        document.body.classList.remove('celebrating');
        overlay.remove();
        msg.remove();
    }, 4500);
}

function checkVictory(sorteoResult: any, blockHeight: number): void {
    if (!authState.pubkey || !sorteoResult.winners) return;

    const isWinner = sorteoResult.winners.some((w: any) => 
        w.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
    );

    const effectiveLastCelebrated = Math.max(state.lastVictoryBlock, authState.lastCelebratedBlock || 0);

    if (isWinner && blockHeight > effectiveLastCelebrated) {
        console.log(`🎉 [VICTORIA] ¡Ganaste en el bloque ${blockHeight}!`);
        state.lastVictoryBlock = blockHeight;
        localStorage.setItem('satlotto_last_victory_block', blockHeight.toString());
        triggerVictoryCelebration(sorteoResult.winningNumber, blockHeight);
    }
}

function showTransparencyModal(blockHash: string, blockHeight: number, winningNumber: number): void {
    const transparencyModalElement = document.createElement('div');
    transparencyModalElement.className = 'modal-bg';
    transparencyModalElement.style.display = 'flex';
    transparencyModalElement.innerHTML = `
        <div class="modal" style="max-width: 450px; text-align: left">
            <h2 style="text-align: center">Transparencia</h2>
            <p style="font-size: 0.9rem; margin-bottom: 20px; color: rgba(255,255,255,0.8); line-height: 1.4">
                El número ganador <strong>${winningNumber}</strong> se obtiene a partir del hash del último bloque en que se sorteo (<b>${blockHeight}</b>):
            </p>
            
            <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,212,0.05)">
                <div style="font-family: monospace; font-size: 0.75rem; word-break: break-all; color: var(--text-dim)">${blockHash}</div>
            </div>

            <div style="margin-bottom: 0">
                <label style="font-size: 0.72rem; color: var(--neon-orange); text-transform: uppercase; display: block">Verificalo vos mismo:</label>
                <code id="copyFormula" class="verify-command" style="cursor: pointer; padding: 12px; display: block; background: rgba(0,0,0,0.4); position: relative; margin: 5px 0">
                    BigInt('0x${blockHash}') % 21n + 1n
                </code>
                <div id="copyStatus" style="color: var(--neon-green); font-size: 0.65rem; text-align: center; margin-top: -10px; margin-bottom: 0; opacity: 0; transition: opacity 0.3s; font-weight: bold">¡Copiado! ⚡</div>
            </div>

            <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px; margin-bottom: 15px; line-height: 1.2; text-align: center">
                Copiá y pegá la fórmula en la consola (F12) o en tu terminal para verificar el resultado exacto.
            </p>

            <button class="auth-btn" id="closeHelp" style="width: 100%">Entendido</button>
        </div>
    `;

    transparencyModalElement.querySelector('#closeHelp')?.addEventListener('click', () => transparencyModalElement.remove());
    transparencyModalElement.querySelector('#copyFormula')?.addEventListener('click', async () => {
        const formulaToCopy = `BigInt('0x${blockHash}') % 21n + 1n`;
        const success = await copyToClipboard(formulaToCopy);
        if (success) {
            const formulaDisplay = document.getElementById('copyFormula');
            const copyStatus = document.getElementById('copyStatus');
            if (formulaDisplay) {
                formulaDisplay.classList.add('copied');
                setTimeout(() => formulaDisplay.classList.remove('copied'), 300);
            }
            if (copyStatus) {
                copyStatus.style.opacity = '1';
                setTimeout(() => copyStatus.style.opacity = '0', 1500);
            }
        }
    });

    document.body.appendChild(transparencyModalElement);
}

export function renderResult(sorteoResult: any, blockHeight: number): void {
    const resultDisplayContainer = document.getElementById('lastResult');
    if (!resultDisplayContainer || !sorteoResult || !sorteoResult.resolved) return;

    // Verificar si el usuario ganó
    checkVictory(sorteoResult, blockHeight);

    resultDisplayContainer.innerHTML = `
        <h3>Último Sorteo: <strong class="text-orange">${state.targetBlock-21}</strong></h3>
        <p>Número ganador: <strong class="text-orange">${sorteoResult.winningNumber}</strong> <span class="help-icon" id="helpIcon">?</span></p>
        <p id="winnersListContainer">Ganadores: </p>
    `;

    const winnersText = document.createElement('strong');
    winnersText.textContent = sorteoResult.winners?.length
        ? sorteoResult.winners.map((winner: any) => winner.alias || resolveName(winner.pubkey)).join(', ')
        : 'Nadie';
    
    resultDisplayContainer.querySelector('#winnersListContainer')?.appendChild(winnersText);

    resultDisplayContainer.querySelector('#helpIcon')?.addEventListener('click', () => showTransparencyModal(sorteoResult.blockHash, blockHeight, sorteoResult.winningNumber));
}
