import { currentBlock, targetBlock } from './components/state';
import { renderOuterRing, renderInnerRing } from './components/clock';
import { makePayment } from './components/payment';

function init(): void {
    renderOuterRing();
    renderInnerRing();

    const info = document.getElementById('clockInfo');
    if (info) {
        info.innerHTML = `Bloque: <strong class="text-green">${currentBlock}</strong> • Sorteo: <strong class="text-orange">${targetBlock}</strong>`;
    }

    (window as any).makePayment = makePayment;
}

init();
