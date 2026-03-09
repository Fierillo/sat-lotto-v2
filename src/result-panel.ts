import { resolveName } from './utils/nostr-service';
import { copyToClipboard } from './utils/clipboard-utils';

function showTransparencyModal(blockHash: string, blockHeight: number, winningNumber: number): void {
    const transparencyModalElement = document.createElement('div');
    transparencyModalElement.className = 'modal-bg';
    transparencyModalElement.style.display = 'flex';
    transparencyModalElement.innerHTML = `
        <div class="modal" style="max-width: 450px; text-align: left">
            <h2 style="text-align: center">Transparencia</h2>
            <p style="font-size: 0.9rem; margin-bottom: 20px; color: rgba(255,255,255,0.8); line-height: 1.4">
                El número ganador <strong>${winningNumber}</strong> se obtiene a partir del hash del último bloque objetivo (<b>${blockHeight}</b>):
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

    const winnersNamesList = sorteoResult.winners?.length
        ? sorteoResult.winners.map((winner: any) => winner.alias || resolveName(winner.pubkey)).join(', ')
        : 'Nadie';

    resultDisplayContainer.innerHTML = `
        <h3>Último Sorteo</h3>
        <p>Número ganador: <strong class="text-orange">${sorteoResult.winningNumber}</strong> <span class="help-icon" id="helpIcon">?</span></p>
        <p>Ganadores: <strong>${winnersNamesList}</strong></p>
    `;

    resultDisplayContainer.querySelector('#helpIcon')?.addEventListener('click', () => showTransparencyModal(sorteoResult.blockHash, blockHeight, sorteoResult.winningNumber));
}
