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
        const response = await fetch('/api/blocks/tip');
        const data = await response.json();
        if (data.height) {
            state.currentBlock = data.height;
            state.targetBlock = data.target;
            localStorage.setItem('satlotto_blocks', JSON.stringify({ height: data.height, target: data.target }));
        }
    } catch {
        // Fallback or use existing state
    }
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
