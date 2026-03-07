import { resolveName } from '../utils/nostr';

export function createLeftDashboard(): HTMLElement {
    const db = document.createElement('div');
    db.id = 'leftDashboard';
    db.innerHTML = `
        <div id="betsTable" class="bets-panel" style="margin-top: 0;"></div>
    `;
    return db;
}

export function createRightDashboard(): HTMLElement {
    const db = document.createElement('div');
    db.id = 'rightDashboard';
    db.innerHTML = `
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
    `;
    return db;
}

export function renderBetsTable(bets: Array<{ pubkey: string; selected_number: number; alias?: string }>): void {
    const el = document.getElementById('betsTable');
    if (!el) return;
    if (!bets.length) { el.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>'; return; }

    const rows = bets.map(b => {
        const name = b.alias || resolveName(b.pubkey);
        return `<tr><td>${name}</td><td>${b.selected_number}</td></tr>`;
    }).join('');
    el.innerHTML = `<h3>Apuestas Activas</h3><table><thead><tr><th>Jugador</th><th>Número</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function showHelpModal(blockHash: string, blockHeight: number, winningNumber: number): void {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal" style="max-width: 450px; text-align: left;">
            <h2 style="text-align: center;">Transparencia</h2>
            <p style="font-size: 0.9rem; margin-bottom: 20px; color: rgba(255,255,255,0.8); line-height: 1.4;">
                El número ganador <strong>${winningNumber}</strong> se obtiene a partir del hash del último bloque objetivo (<b>${blockHeight}</b>):
            </p>
            
            <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,212,0.05);">
                <div style="font-family: monospace; font-size: 0.75rem; word-break: break-all; color: var(--text-dim); margin-top: 5px;">${blockHash}</div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="font-size: 0.72rem; color: var(--neon-orange); text-transform: uppercase; display: block; margin-bottom: 8px;">Verificalo por vos mismo:</label>
                <code id="copyFormula" class="verify-command" style="cursor: pointer; padding: 12px; display: block; background: rgba(0,0,0,0.4);" title="Click para copiar">BigInt('0x${blockHash}') % 21n + 1n</code>
                <p style="font-size: 0.72rem; color: var(--text-dim); margin-top: 10px; font-style: italic;">Hace click arriba para copiar la fórmula y pegala en tu consola (F12) o terminal (Node).</p>
            </div>

            <button class="auth-btn" id="closeHelpModal" style="margin-top: 10px; width: 100%;">Entendido</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeHelpModal')?.addEventListener('click', () => modal.remove());

    document.getElementById('copyFormula')?.addEventListener('click', () => {
        const text = `BigInt('0x${blockHash}') % 21n + 1n`;
        navigator.clipboard.writeText(text);
        const el = document.getElementById('copyFormula');
        if (el) {
            const original = el.innerText;
            el.innerText = '¡Copiado!';
            setTimeout(() => el.innerText = original, 1000);
        }
    });
}

export function renderResult(result: any, blockHeight: number): void {
    const el = document.getElementById('lastResult');
    if (!el || !result || !result.resolved) return;

    const winnersText = result.winners?.length
        ? result.winners.map((w: any) => w.alias || resolveName(w.pubkey)).join(', ')
        : 'Nadie';

    el.innerHTML = `
        <h3>Último Sorteo</h3>
        <p>Número ganador: <strong class="text-orange">${result.winningNumber}</strong> <span id="helpLucky" class="help-icon">?</span></p>
        <p>Ganadores: <strong>${winnersText}</strong></p>
    `;

    document.getElementById('helpLucky')?.addEventListener('click', () => showHelpModal(result.blockHash, blockHeight, result.winningNumber));
}
