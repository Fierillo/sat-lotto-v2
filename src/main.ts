import { state } from './components/state';
import { createClock, updateClockRings, selectNumber, updateCenterButton } from './components/clock';
import { makePayment } from './components/payment';
import { createUserProfile, createLoginModal, updateAuthUI } from './components/auth';
import { createLeftDashboard, createRightDashboard } from './components/dashboard';
import { renderBetsTable } from './components/bets-table';
import { renderResult } from './components/result-panel';
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
    const { checkExternalLogin, authState, finishLogin } = await import('./components/auth');
    checkExternalLogin();

    if (authState.pubkey) {
        finishLogin();
    }

    if ((window as any).lastExternalSig) {
        const signedEvent = (window as any).lastExternalSig;
        const stateData = JSON.parse(localStorage.getItem('satlotto_pending_bet') || '{}');
        if (stateData.targetBlock && authState.pubkey) {
            const { logRemote } = await import('./components/auth');
            logRemote({ msg: 'Sending signed event to server', block: stateData.targetBlock });
            const apiResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent })
            });

            const responseContent = await apiResponse.json();
            logRemote({ msg: 'Server response for signed event', ok: apiResponse.ok, hasPr: !!responseContent.paymentRequest });

            if (apiResponse.ok && responseContent.paymentRequest) {
                const { showInvoiceModal } = await import('./components/invoice-modal');
                const { confirmBet } = await import('./utils/ledger');
                const { updateUI } = await import('./main');

                showInvoiceModal(responseContent.paymentRequest, async () => {
                    await confirmBet(responseContent.paymentHash);
                    await updateUI();
                    document.body.classList.add('flash-green');
                    setTimeout(() => document.body.classList.remove('flash-green'), 4000);
                });
            } else {
                alert('Error al generar la apuesta: ' + (responseContent.error || 'Server error'));
            }
        }
        delete (window as any).lastExternalSig;
        localStorage.removeItem('satlotto_pending_bet');
    }

    (window as any).makePayment = makePayment;
    (window as any).selectNumber = selectNumber;
    (window as any).updateCenterButton = updateCenterButton;
    (window as any).updateUI = updateUI;

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
