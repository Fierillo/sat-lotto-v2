import { state, BLOCKS } from './components/state';
import { createClock, updateClockRings, selectNumber, updateCenterButton } from './components/clock';
import { makePayment } from './components/payment';
import { createUserProfile, createLoginModal, updateAuthUI } from './components/auth';
import { createLeftDashboard, createRightDashboard, renderBetsTable, renderResult } from './components/tables';
import { createPool, updatePool } from './components/pool';
import { fetchBets, fetchResult, fetchPoolBalance } from './utils/ledger';

function createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `<h1><span>SatLotto</span></h1><p class="subtitle">Proba tu suerte, cada 21 bloques</p>`;
    return header;
}

export async function updateUI(): Promise<void> {
    updateClockRings();
    const info = document.getElementById('clockInfo');
    if (info) info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;

    const bets = await fetchBets(state.targetBlock);
    renderBetsTable(bets);

    const balance = await fetchPoolBalance();
    updatePool(balance);

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
    (window as any).updateCenterButton = updateCenterButton;

    const app = document.createElement('div');
    app.id = 'app';
    app.appendChild(createUserProfile());
    app.appendChild(createLoginModal());
    app.appendChild(createHeader());
    app.appendChild(createPool());

    const gameContainer = document.createElement('div');
    gameContainer.className = 'game-container';
    gameContainer.appendChild(createLeftDashboard());
    gameContainer.appendChild(createClock());
    gameContainer.appendChild(createRightDashboard());

    app.appendChild(gameContainer);

    document.body.prepend(app);
    updateAuthUI(); // set initial state

    await fetchCurrentBlock();
    await updateUI();
    setInterval(async () => {
        await fetchCurrentBlock();
        await updateUI();
    }, 21000);
}

init();
