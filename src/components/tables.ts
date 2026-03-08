import { resolveName } from '../utils/nostr';

export function createLeftDashboard(): HTMLElement {
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'leftDashboard';
    dashboardContainer.innerHTML = '<div id="betsTable" class="bets-panel" style="margin-top: 0"></div>';
    return dashboardContainer;
}

export function createRightDashboard(): HTMLElement {
    const dashboardContainer = document.createElement('div');
    dashboardContainer.id = 'rightDashboard';
    dashboardContainer.innerHTML = `
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
    `;
    return dashboardContainer;
}

export function renderBetsTable(activeBets: Array<{ pubkey: string; selected_number: number; alias?: string }>): void {
    const betsTableContainer = document.getElementById('betsTable');
    if (!betsTableContainer) return;

    if (!activeBets.length) {
        betsTableContainer.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>';
        return;
    }

    const tableRowsHtml = activeBets.map(bet => `
        <tr>
            <td>${bet.alias || resolveName(bet.pubkey)}</td>
            <td>${bet.selected_number}</td>
        </tr>
    `).join('');

    betsTableContainer.innerHTML = `
        <h3>Apuestas Activas</h3>
        <table>
            <thead>
                <tr><th>Jugador</th><th>Número</th></tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
        </table>
    `;
}

function showHelpModal(blockHash: string, blockHeight: number, winningNumber: number): void {
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
                <div style="font-family: monospace; font-size: 0.75rem; word-break: break-all; color: var(--text-dim); margin-top: 5px">${blockHash}</div>
            </div>

            <div style="margin-bottom: 20px">
                <label style="font-size: 0.72rem; color: var(--neon-orange); text-transform: uppercase; display: block; marginBottom: 8px">Verificalo por vos mismo:</label>
                <code id="copyFormula" class="verify-command" style="cursor: pointer; padding: 12px; display: block; background: rgba(0,0,0,0.4)">
                    BigInt('0x${blockHash}') % 21n + 1n
                </code>
            </div>

            <button class="auth-btn" id="closeHelp" style="width: 100%">Entendido</button>
        </div>
    `;

    transparencyModalElement.querySelector('#closeHelp')?.addEventListener('click', () => transparencyModalElement.remove());
    transparencyModalElement.querySelector('#copyFormula')?.addEventListener('click', () => {
        const formulaToCopy = `BigInt('0x${blockHash}') % 21n + 1n`;
        navigator.clipboard.writeText(formulaToCopy);
        const formulaDisplay = document.getElementById('copyFormula');
        if (formulaDisplay) {
            const originalText = formulaDisplay.innerText;
            formulaDisplay.innerText = '¡Copiado!';
            setTimeout(() => formulaDisplay.innerText = originalText, 1000);
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

    resultDisplayContainer.querySelector('#helpIcon')?.addEventListener('click', () => showHelpModal(sorteoResult.blockHash, blockHeight, sorteoResult.winningNumber));
}
