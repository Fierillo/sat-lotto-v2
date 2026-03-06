import { state, BLOCKS } from './components/state';
import { createClock, updateClockRings, selectNumber } from './components/clock';
import { makePayment } from './components/payment';
import { createLoginButton, createLoginModal } from './components/auth';
import { fetchBets, fetchResult } from './utils/ledger';

function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `<h1><span>SatLotto</span></h1><p class="subtitle">Proba tu suerte, cada 21 bloques</p>`;
    return header;
}

function createDashboard(): HTMLElement {
    const db = document.createElement('div');
    db.id = 'dashboard';
    db.innerHTML = `
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
        <div id="betsTable" class="bets-panel"></div>
    `;
    return db;
}

export function renderBetsTable(bets: Array<{ pubkey: string; selected_number: number }>): void {
    const el = document.getElementById('betsTable');
    if (!el) return;
    if (!bets.length) { el.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>'; return; }

    const rows = bets.map(b => `<tr><td>${b.pubkey.slice(0, 8)}…</td><td>${b.selected_number}</td></tr>`).join('');
    el.innerHTML = `<h3>Apuestas Activas</h3><table><thead><tr><th>Jugador</th><th>Número</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderResult(result: any): void {
    const el = document.getElementById('lastResult');
    if (!el) return;
    if (!result || !result.resolved) { el.innerHTML = ''; return; }

    const winnersText = result.winners?.length ? result.winners.map((w: any) => `${w.pubkey.slice(0, 8)}…`).join(', ') : 'Nadie';
    el.innerHTML = `<h3>Último Sorteo</h3><p>Número ganador: <strong class="text-orange">${result.winningNumber}</strong></p><p>Ganadores: <strong>${winnersText}</strong></p>`;
}

export async function updateUI(): Promise<void> {
    updateClockRings();
    const info = document.getElementById('clockInfo');
    if (info) info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;

    const bets = await fetchBets(state.targetBlock);
    renderBetsTable(bets);

    const prevTarget = state.targetBlock - BLOCKS;
    const result = await fetchResult(prevTarget);
    renderResult(result);
}

async function fetchCurrentBlock(): Promise<void> {
    try {
        const response = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = await response.text();
        state.currentBlock = parseInt(height, 10);
    } catch {
        state.currentBlock = 899990;
    }
    const remainder = state.currentBlock % BLOCKS;
    state.targetBlock = state.currentBlock + (remainder === 0 ? 0 : BLOCKS - remainder);
}

async function init(): Promise<void> {
    // Inject global functions for buttons in pure HTML if needed
    (window as any).makePayment = makePayment;
    (window as any).selectNumber = selectNumber;

    const app = document.createElement('div');
    app.id = 'app';
    app.appendChild(createLoginButton());
    app.appendChild(createLoginModal());
    app.appendChild(createHeader());
    app.appendChild(createClock());
    app.appendChild(createDashboard());

    document.body.prepend(app);

    await fetchCurrentBlock();
    await updateUI();
    setInterval(async () => {
        await fetchCurrentBlock();
        await updateUI();
    }, 21000);
}

init();
