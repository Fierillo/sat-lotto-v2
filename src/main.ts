import { state } from './components/state';
import { createClock, updateClockRings, selectNumber, updateCenterButton } from './components/clock';
import { makePayment } from './components/payment';
import { createUserProfile, createLoginModal, updateAuthUI } from './components/auth';
import { createLeftDashboard, createRightDashboard, renderBetsTable, renderResult } from './components/tables';
import { createPool, updatePool } from './components/pool';
import { fetchBets, fetchResult, fetchPoolBalance } from './utils/ledger';

function createApplicationHeader(): HTMLElement {
    const headerElement = document.createElement('div');
    headerElement.className = 'header';
    headerElement.innerHTML = `<h1><span>SatLotto</span></h1><p class="subtitle">Proba tu suerte, cada 21 bloques</p>`;
    return headerElement;
}

export async function updateUI(): Promise<void> {
    const outerRingElement = document.getElementById('outerRing');
    const innerCircleContainer = document.getElementById('innerCircle');
    if (outerRingElement && innerCircleContainer) {
        updateClockRings(outerRingElement, innerCircleContainer);
    }

    const clockInfoDisplay = document.getElementById('clockInfo');
    if (clockInfoDisplay) {
        clockInfoDisplay.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;
    }

    const activeBetsFromApi = await fetchBets(state.targetBlock);
    renderBetsTable(activeBetsFromApi);

    const currentJackpotBalance = await fetchPoolBalance();
    updatePool(currentJackpotBalance);

    const previousSorteoBlock = Math.floor(state.currentBlock / 21) * 21;
    const previousSorteoResult = await fetchResult(previousSorteoBlock);
    renderResult(previousSorteoResult, previousSorteoBlock);
}

async function fetchLatestBlockData(): Promise<void> {
    try {
        const blockApiResponse = await fetch('/api/blocks/tip');
        const latestBlockInfo = await blockApiResponse.json();
        if (latestBlockInfo.height) {
            state.currentBlock = latestBlockInfo.height;
            state.targetBlock = latestBlockInfo.target;
            localStorage.setItem('satlotto_blocks', JSON.stringify({
                height: latestBlockInfo.height,
                target: latestBlockInfo.target
            }));
        }
    } catch (apiError) {
        console.error('[Main] Failed to sync block data', apiError);
    }
}

async function initializeApplication(): Promise<void> {
    (window as any).makePayment = makePayment;
    (window as any).selectNumber = selectNumber;
    (window as any).updateCenterButton = updateCenterButton;

    const mainAppContainer = document.createElement('div');
    mainAppContainer.id = 'app';
    mainAppContainer.appendChild(createUserProfile());
    mainAppContainer.appendChild(createLoginModal());
    mainAppContainer.appendChild(createApplicationHeader());
    mainAppContainer.appendChild(createPool());

    const gameLayoutContainer = document.createElement('div');
    gameLayoutContainer.className = 'game-container';
    gameLayoutContainer.appendChild(createLeftDashboard());
    gameLayoutContainer.appendChild(createClock());
    gameLayoutContainer.appendChild(createRightDashboard());

    mainAppContainer.appendChild(gameLayoutContainer);
    document.body.prepend(mainAppContainer);

    updateAuthUI();

    await fetchLatestBlockData();
    await updateUI();

    setInterval(async () => {
        await fetchLatestBlockData();
        await updateUI();
    }, 21000);
}

initializeApplication();
