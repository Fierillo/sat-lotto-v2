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
    renderInnerRing();

    const info = document.getElementById('clockInfo');
    if (info) {
        info.innerHTML = `Bloque: <strong class="text-green">${state.currentBlock}</strong> • Sorteo: <strong class="text-orange">${state.targetBlock}</strong>`;
    }
}

async function init(): Promise<void> {
    (window as any).makePayment = makePayment;

    const update = async () => {
        await fetchCurrentBlock();
        updateUI();
    };

    await update();
    setInterval(update, 21000);
}

init();
