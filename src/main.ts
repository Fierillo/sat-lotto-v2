import { state, BLOCKS } from './components/state';
import { renderOuterRing, renderInnerRing } from './components/clock';
import { makePayment } from './components/payment';
import { autoLogin, loginWithNwc } from './components/auth';
import { fetchBets, fetchResult } from './utils/ledger';

async function fetchCurrentBlock(): Promise<void> {
    try {
        const response = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = await response.text();
        state.currentBlock = parseInt(height, 10);
    } catch {
        state.currentBlock = 892341;
    }
    const remainder = state.currentBlock % BLOCKS;
    state.targetBlock = state.currentBlock + (remainder === 0 ? 0 : BLOCKS - remainder);
}

function renderBetsTable(bets: Array<{ pubkey: string; selected_number: number }>): void {
    const el = document.getElementById('betsTable');
    if (!el) return;

    if (!bets.length) {
        el.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>';
        return;
    }

    const rows = bets.map(b =>
        `<tr><td>${b.pubkey.slice(0, 8)}…</td><td>${b.selected_number}</td></tr>`
    ).join('');

    el.innerHTML = `
        <h3>Apuestas Activas</h3>
        <table><thead><tr><th>Jugador</th><th>Número</th></tr></thead>
        <tbody>${rows}</tbody></table>
    `;
}

function renderResult(result: any): void {
    const el = document.getElementById('lastResult');
    if (!el) return;
    if (!result || !result.resolved) { el.innerHTML = ''; return; }

    const winnersText = result.winners?.length
        ? result.winners.map((w: any) => `${w.pubkey.slice(0, 8)}…`).join(', ')
        : 'Nadie';

    el.innerHTML = `
        <h3>Último Sorteo</h3>
        <p>Número ganador: <strong class="text-orange">${result.winningNumber}</strong></p>
        <p>Ganadores: <strong>${winnersText}</strong></p>
    `;
}

export async function updateUI(): Promise<void> {
    renderOuterRing();

    const info = document.getElementById('clockInfo');
    if (info) {
        info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;
    }

    const bets = await fetchBets(state.targetBlock);
    renderBetsTable(bets);

    const prevTarget = state.targetBlock - BLOCKS;
    const result = await fetchResult(prevTarget);
    renderResult(result);
}

function showLoginModal(): void {
    const el = document.getElementById('loginModal');
    if (el) el.style.display = 'flex';
}

function hideLoginModal(): void {
    const el = document.getElementById('loginModal');
    if (el) el.style.display = 'none';
}

function setAuthError(msg: string): void {
    const err = document.getElementById('authError');
    if (err) err.textContent = msg;
}

async function handleNwcLogin(): Promise<void> {
    try {
        setAuthError('');
        const input = document.getElementById('nwcInput') as HTMLInputElement;
        await loginWithNwc(input?.value || '');
    } catch (e: any) {
        setAuthError(e.message);
    }
}

function handleAutoLogin(): void {
    setAuthError('');
    autoLogin(setAuthError);
}

function injectUI(): void {
    const app = document.createElement('div');
    app.id = 'app';
    app.innerHTML = `
        <button id="loginBtn" class="top-login-btn" onclick="showLoginModal()">ENTRAR</button>
        <div id="loginModal" class="modal-bg">
            <div class="modal">
                <h2>Conectá tu Wallet</h2>
                <button class="auth-btn" onclick="handleAutoLogin()">Login con extensión</button>
                <div class="nwc-section">
                    <input type="password" id="nwcInput" placeholder="nostr+walletconnect://..." />
                    <button class="auth-btn" onclick="handleNwcLogin()">Conectar NWC</button>
                </div>
                <p id="authError" class="auth-error"></p>
                <button class="close-btn" onclick="hideLoginModal()">Cerrar</button>
            </div>
        </div>
        <div class="header">
            <h1><span>SatLotto</span></h1>
            <p class="subtitle">Proba tu suerte, cada 21 bloques</p>
        </div>
        <div id="clock">
            <div id="outerRing" class="ring"></div>
            <div class="inner-ring-container" id="innerCircle"></div>
            <div id="paymentStep">
                <button class="pay-btn" onclick="makePayment()">JUGAR</button>
            </div>
        </div>
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
        <div id="betsTable" class="bets-panel"></div>
    `;
    document.body.prepend(app);
}

async function init(): Promise<void> {
    injectUI();

    (window as any).makePayment = makePayment;
    (window as any).showLoginModal = showLoginModal;
    (window as any).hideLoginModal = hideLoginModal;
    (window as any).handleNwcLogin = handleNwcLogin;
    (window as any).handleAutoLogin = handleAutoLogin;

    renderInnerRing();
    await fetchCurrentBlock();
    await updateUI();
    setInterval(async () => {
        await fetchCurrentBlock();
        await updateUI();
    }, 21000);
}

init();
