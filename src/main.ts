import { state } from './app-state';
import { createClock, updateClockRings, selectNumber, updateCenterButton } from './clock/game-clock';
import { makePayment } from './bet-handler';
import { createUserProfile, createLoginModal } from './auth/login-modal';
import { updateAuthUI, finishLogin, checkExternalLogin } from './auth/auth-manager';
import { authState } from './auth/auth-state';
import { drawDashboardElements } from './ui/layout-manager';
import { renderBetsTable } from './bets-table';
import { renderResult } from './result-panel';
import { createPool, updatePool } from './jackpot-panel';
import { handleAutoLogin, handleNwcLogin, handleBunkerLogin, initNostrConnect } from './auth/login-handlers';
import { fetchBets, fetchResult } from './utils/game-api';
import { injectDebugButtons } from '../tests/debug-ui';

export async function updateUI(): Promise<void> {
    const outer = document.getElementById('outerRing');
    const inner = document.getElementById('innerCircle');
    if (outer && inner) updateClockRings(outer, inner);
    updateCenterButton();

    const info = document.getElementById('clockInfo');
    if (info) info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;

    const resBlock = Math.floor(state.currentBlock / 21) * 21;
    const promises: Promise<any>[] = [fetchBets(state.targetBlock)];
    
    // Only fetch result if the cycle changed or we haven't processed this result yet
    const shouldFetchResult = state.lastResolvedResultBlock !== resBlock;
    if (shouldFetchResult) {
        promises.push(fetchResult(resBlock));
    }

    Promise.all(promises).then(([bets, res]) => {
        renderBetsTable(bets);
        updatePool(state.poolBalance);
        
        if (shouldFetchResult && res?.resolved) {
            renderResult(res, resBlock);
            state.lastResolvedResultBlock = resBlock;
        }
        
        state.lastRenderedBlock = state.currentBlock;
    });
}

async function syncBlocks(): Promise<void> {
    try {
        const resp = await fetch('/api/blocks/tip');
        const data = await resp.json();
        if (data.height) {
            state.currentBlock = data.height;
            state.targetBlock = data.target;
            state.poolBalance = data.poolBalance || 0;
            localStorage.setItem('satlotto_blocks', JSON.stringify(data));
        }
    } catch {}
}

async function init(): Promise<void> {
    checkExternalLogin();
    if (authState.pubkey) finishLogin();

    (window as any).makePayment = makePayment;
    (window as any).selectNumber = selectNumber;
    (window as any).updateCenterButton = updateCenterButton;
    (window as any).updateUI = updateUI;
    (window as any).handleAutoLogin = handleAutoLogin;
    (window as any).handleNwcLogin = handleNwcLogin;
    (window as any).handleBunkerLogin = handleBunkerLogin;
    (window as any).initNostrConnect = initNostrConnect;

    let app = document.getElementById('app');
    if (app) {
        app.innerHTML = '';
    } else {
        app = document.createElement('div');
        app.id = 'app';
        document.body.prepend(app);
    }

    app.appendChild(createUserProfile(authState.nip05 || ''));
    
    const handlers = {
        onExtLogin: handleAutoLogin,
        onNwcLogin: handleNwcLogin,
        onBunkerLogin: handleBunkerLogin,
        onRefreshConnect: initNostrConnect,
        onClose: () => { const m = document.getElementById('loginModal'); if (m) m.style.display = 'none'; }
    };
    app.appendChild(createLoginModal(handlers));
    
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `<h1><span>SatLotto</span></h1><p class="subtitle">Proba tu suerte, cada 21 bloques</p>`;
    app.prepend(header);
    app.appendChild(createPool());
    
    injectDebugButtons();

    const game = document.createElement('div');
    game.className = 'game-container';
    game.appendChild(createClock());
    drawDashboardElements(game);
    app.appendChild(game);

    updateAuthUI();
    await updateUI();
    setInterval(async () => { await syncBlocks(); await updateUI(); }, 21000);
}

init();
if (import.meta.hot) import.meta.hot.accept();
