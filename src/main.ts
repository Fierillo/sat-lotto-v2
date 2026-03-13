import { state } from './app-state';
import { createClock, updateClockRings, selectNumber, updateCenterButton } from './clock/game-clock';
import { makePayment } from './bet-handler';
import { createUserProfile, createLoginModal } from './auth/login-modal';
import { updateAuthUI, finishLogin, checkExternalLogin } from './auth/auth-manager';
import { authState, logRemote } from './auth/auth-state';
import { drawDashboardElements } from './ui/layout-manager';
import { renderBetsTable } from './bets-table';
import { renderChampionsTable } from './champions-table';
import { renderResult } from './result-panel';
import { createPool, updatePool } from './jackpot-panel';
import { handleAutoLogin, handleNwcLogin, handleBunkerLogin, initNostrConnect } from './auth/login-handlers';
import { fetchGameState } from './utils/game-api';
import { injectDebugButtons } from '../tests/debug-ui';

export async function updateUI(): Promise<void> {
    try {
        const data = await fetchGameState();
        if (!data) return;

        // 1. Update Blocks & Pool State
        state.currentBlock = data.block.height;
        state.targetBlock = data.block.target;
        state.poolBalance = data.block.poolBalance;
        localStorage.setItem('satlotto_blocks', JSON.stringify(data.block));
        localStorage.setItem('satlotto_pool', state.poolBalance.toString());

        // 2. Render Clock Info
        const info = document.getElementById('clockInfo');
        if (info) info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;

        const outer = document.getElementById('outerRing');
        const inner = document.getElementById('innerCircle');
        if (outer && inner) updateClockRings(outer, inner);
        updateCenterButton();

        // 3. Render Tables
        if (data.activeBets) {
            state.bets = data.activeBets;
            localStorage.setItem('satlotto_last_bets', JSON.stringify(data.activeBets));
            renderBetsTable(data.activeBets);
        }

        if (data.champions) {
            renderChampionsTable(data.champions);
        }

        updatePool(state.poolBalance);

        // 4. Render Results
        if (data.lastResult?.resolved) {
            state.lastResult = data.lastResult;
            localStorage.setItem('satlotto_last_result', JSON.stringify(data.lastResult));
            renderResult(data.lastResult, Math.floor(data.lastResult.targetBlock));
            state.lastResolvedResultBlock = data.lastResult.targetBlock;
        } else if (state.lastResult) {
            renderResult(state.lastResult, Math.floor(state.lastResult.targetBlock));
        }

        state.lastRenderedBlock = state.currentBlock;
    } catch (e) {
        console.error('[updateUI] Failed:', e);
    }
}

async function init(): Promise<void> {
    logRemote({ msg: 'APP_STARTED', url: window.location.href });
    
    const pendingPubkey = sessionStorage.getItem('pending_pubkey');
    if (pendingPubkey) {
        sessionStorage.removeItem('pending_pubkey');
        sessionStorage.removeItem('login_pending');
        authState.pubkey = pendingPubkey;
        logRemote({ msg: 'LOGIN_FROM_PENDING', pubkey: pendingPubkey.substring(0, 16) + '...' });
        finishLogin();
        return;
    }

    logRemote({ msg: 'APP_STARTED', url: window.location.href });
    checkExternalLogin();
    if (authState.pubkey) finishLogin();

    let pollInterval: any = null;

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        
        pollInterval = setInterval(() => {
            checkExternalLogin();
            
            if (authState.pubkey) {
                clearInterval(pollInterval);
                sessionStorage.removeItem('login_pending');
                logRemote({ msg: 'LOGIN_SUCCESS', pubkey: authState.pubkey.substring(0, 16) + '...' });
                finishLogin();
            }
        }, 2000);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            logRemote({ 
                msg: 'VISIBILITY_RETURN', 
                href: window.location.href,
                search: window.location.search
            });
            checkExternalLogin();
        }
    });

    window.addEventListener('pageshow', (event) => {
        logRemote({ 
            msg: 'PAGE_SHOW', 
            persisted: event.persisted,
            href: window.location.href
        });
        checkExternalLogin();
    });

    startPolling();

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
    
    // injectDebugButtons(); 

    const game = document.createElement('div');
    game.className = 'game-container';
    game.appendChild(createClock());
    drawDashboardElements(game);
    app.appendChild(game);

    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
        <div class="footer-content">
            <div class="footer-info">
                <a href="https://github.com/fierillo/sat-lotto-v2" target="_blank">SatLotto</a> fue creado con amor por <a href="https://github.com/fierillo" target="_blank">Fierillo</a>
            </div>
            <div class="powered-by">
                <span>Powered by</span>
                <a href="https://lacrypta.ar" target="_blank" class="lacrypta-logo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 255.18 56.53" width="100" height="22" fill="currentColor">
                        <path d="M11.11,47.57V42.28H45.45v-3.8H18.69V33.19H45.45V29.38H25.25V24.1h20.2V24c0-12.55-10.17-24-22.72-24h0C10.18,0,0,11.48,0,24V52.31H45.45V47.57Z" />
                        <rect x="71.19" y="16.56" width="4.66" height="30.78" />
                        <path d="M81.49,26a22.55,22.55,0,0,1,9.16-2.17c9,0,11.55,4.2,11.55,10.57V47.24H97V45.46c-2.29,1.52-5.82,2.21-9.33,2.21-6.48,0-8.82-3.43-8.82-6.88s3.18-7.74,9.43-7.74A16.59,16.59,0,0,1,97,35.3v-.93C97,30,96.38,28,91,28a19.49,19.49,0,0,0-9.53,2.67ZM96.8,40.35a12.85,12.85,0,0,0-7.8-3c-3.58,0-5,1.8-5,3.44,0,2.22,2.81,3,5.59,2.6a12.54,12.54,0,0,0,7.16-3.11Z" />
                        <path d="M132.87,39A6.12,6.12,0,0,1,127,42.5c-4.72,0-6.39-3.8-6.39-7s1.67-7,6.39-7A6.13,6.13,0,0,1,132.87,32l.25.51,4.81-2.83-.26-.45c-1.47-2.58-4.52-5.66-10.68-5.66-8.47,0-12.33,6.19-12.33,11.93S118.52,47.38,127,47.38c6.16,0,9.21-3.08,10.68-5.66l.26-.45-4.81-2.83Z" />
                        <path d="M153.63,23.52c-2.89,0-5.36,1.89-6.95,3.51V23.94h-6.07v23.4h6.07V32.59c1.86-2,4.29-3.32,6.24-3.32A6.39,6.39,0,0,1,158,31.66l.48.66,3-5V27.2c0-.46-3.21-3.68-7.92-3.68" />
                        <path d="M180.82,37.39c-1.49,2.15-4.28,4.6-7.41,4.6-3.65,0-3.95-3.78-3.95-8V23.94h-6V34c0,9.12,2.79,13.37,8.79,13.37a12.83,12.83,0,0,0,8.55-3.91v3c0,2.24-.95,4.9-5.47,4.91h0a10.81,10.81,0,0,1-7.54-2.75l-.4-.42-3.65,4.13.31.35c.14.16,3.5,3.87,11.42,3.87,9.36,0,11.33-5.48,11.33-10.09V23.94h-6Z" />
                        <path d="M204.32,23.52a13,13,0,0,0-8.55,3.38v-3h-6V56.29h6V43.63c1.43,1.64,3.88,3.75,7,3.75,6.19,0,10.34-6.17,10.34-11.93,0-5.5-2.3-11.93-8.79-11.93m2.9,11.93c0,3.27-1.47,6.76-5.59,6.76-2.52,0-4.57-2.56-5.86-4.75V32.67a9.1,9.1,0,0,1,7.41-4c3.65,0,4,4.72,4,6.75" />
                        <path d="M224.31,15.87l-6,1.89v6.17H214.7v4.88h3.63V38c0,4.62,0,9.39,5.76,9.39,2.42,0,5.36-2.17,5.49-2.26l.25-.19-.58-3.79-.65.35a8.64,8.64,0,0,1-3.11.92c-.16,0-.7,0-1-1.27a16,16,0,0,1-.2-3.15V28.81h6.2V23.93h-6.2Z" />
                        <path d="M243.64,23.66a22.07,22.07,0,0,0-9,2.13l-.3.14v5.8l.81-.52A18.27,18.27,0,0,1,244,28.75c4.75,0,5.22,1.6,5.22,5.53a16.61,16.61,0,0,0-7.8-1.78h0a10,10,0,0,0-7.1,2.61,7.57,7.57,0,0,0-2.42,5.31c0,3.43,2.35,7.09,9,7.09a18.69,18.69,0,0,0,8.37-1.72V47.1h6V34.28c0-7.34-3.56-10.62-11.54-10.62m5,16.31a10.88,10.88,0,0,1-6,2.4,5.72,5.72,0,0,1-4.21-.75,1.52,1.52,0,0,1-.54-1.2c0-1.27,1.1-2.76,4.2-2.76A11.16,11.16,0,0,1,248.59,40" />
                    </svg>
                </a>
            </div>
        </div>
    `;
    app.appendChild(footer);

    updateAuthUI();
    await updateUI();
    setInterval(async () => { await updateUI(); }, 21000);
}

init();
