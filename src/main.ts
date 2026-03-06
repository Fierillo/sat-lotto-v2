import { state, BLOCKS } from './components/state';
import { renderOuterRing, renderInnerRing } from './components/clock';
import { makePayment } from './components/payment';

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

function updateUI(): void {
    renderOuterRing();

    const info = document.getElementById('clockInfo');
    if (info) {
        info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;
    }
}

import { authState, loginWithExtension, loginWithMobileApp, loginWithNwc, updateAuthUI } from './components/auth';

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

async function handleExtensionLogin(): Promise<void> {
    try {
        setAuthError('');
        await loginWithExtension();
    } catch (e: any) {
        setAuthError(e.message);
    }
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

function handleMobileLogin(): void {
    try {
        setAuthError('');
        loginWithMobileApp();
    } catch (e: any) {
        setAuthError(e.message);
    }
}

async function init(): Promise<void> {
    (window as any).makePayment = makePayment;
    (window as any).showLoginModal = showLoginModal;
    (window as any).hideLoginModal = hideLoginModal;
    (window as any).handleExtensionLogin = handleExtensionLogin;
    (window as any).handleNwcLogin = handleNwcLogin;
    (window as any).handleMobileLogin = handleMobileLogin;

    const update = async () => {
        await fetchCurrentBlock();
        updateUI();
    };

    renderInnerRing();
    await update();
    setInterval(update, 21000);
}

init();
