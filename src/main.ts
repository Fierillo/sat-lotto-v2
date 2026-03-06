import { state, BLOCKS } from './components/state';
import { renderOuterRing, renderInnerRing } from './components/clock';
import { makePayment } from './components/payment';

async function fetchCurrentBlock(): Promise<void> {
    try {
        const response = await fetch('https://mempool.space/api/blocks/tip/height');
        const height = await response.text();
        state.currentBlock = parseInt(height, 10);
        state.targetBlock = state.currentBlock + BLOCKS - 1;
    } catch {
        state.currentBlock = 892341;
        state.targetBlock = state.currentBlock + BLOCKS - 1;
    }
}

async function init(): Promise<void> {
    await fetchCurrentBlock();

    renderOuterRing();
    renderInnerRing();

    const info = document.getElementById('clockInfo');
    if (info) {
        info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;
    }

    (window as any).makePayment = makePayment;
}

init();
