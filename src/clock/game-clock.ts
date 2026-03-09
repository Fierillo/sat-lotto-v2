import { BLOCKS, state } from '../app-state';
import { authState } from '../auth/auth-state';
import { showLoginModal } from '../auth/auth-manager';
import { showFrozenHelpModal } from '../ui/help-modals';

const markerRadius = 230;

export function createClock(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'clock';
    el.innerHTML = `<div id="outerRing" class="ring"></div><div id="innerCircle" class="inner-ring-container"></div><div id="frozenHelp" class="help-icon">?</div><div id="paymentStep"><button id="centerBtn" class="pay-btn"></button></div>`;
    el.querySelector('#frozenHelp')!.addEventListener('click', (e) => { showFrozenHelpModal(); e.stopPropagation(); });
    
    updateClockRings(el.querySelector('#outerRing') as HTMLElement, el.querySelector('#innerCircle') as HTMLElement);
    return el;
}

export function updateClockRings(outer?: HTMLElement, inner?: HTMLElement): void {
    const ring = outer || document.getElementById('outerRing');
    const container = inner || document.getElementById('innerCircle');
    if (!ring || !container) return;

    // Redundancy Check: If we already rendered this height, don't touch the markers
    const isFirst = ring.children.length === 0;
    if (!isFirst && state.lastRenderedBlock === state.currentBlock) return;

    for (let i = 0; i < BLOCKS; i++) {
        const val = i === 0 ? state.targetBlock : state.targetBlock - BLOCKS + i;
        let marker: HTMLElement;

        if (isFirst) {
            const rad = (i * 360 / BLOCKS - 90) * Math.PI / 180;
            marker = document.createElement('div');
            marker.className = 'block-marker';
            marker.style.transform = `translate(-50%, -50%) translate(${Math.cos(rad) * markerRadius}px, ${Math.sin(rad) * markerRadius}px)`;
            ring.appendChild(marker);
        } else marker = ring.children[i] as HTMLElement;

        marker.textContent = val.toString();
        marker.classList.remove('target', 'current', 'neon-blue');
        if (i === 0) marker.classList.add('target');
        else if (i >= 19) marker.classList.add('neon-blue');
        if (val === state.currentBlock) marker.classList.add('current');
    }

    if (container.children.length === 0) {
        for (let i = 0; i < BLOCKS; i++) {
            const deg = i * 360 / BLOCKS;
            const num = i === 0 ? 21 : i;
            const seg = document.createElement('div');
            seg.className = 'number-segment';
            seg.style.transform = `translateX(-50%) rotate(${deg}deg)`;
            seg.onclick = () => selectNumber(num);
            seg.innerHTML = `<div class="number-text" style="transform: rotate(${-deg}deg)">${num}</div>`;
            container.appendChild(seg);
        }
    }
}

export function updateCenterButton(): void {
    const step = document.getElementById('paymentStep');
    const btn = document.getElementById('centerBtn') as HTMLButtonElement;
    if (!step || !btn) return;

    const isFrozen = state.currentBlock >= state.targetBlock - 2;
    document.body.classList.toggle('phase-frozen', isFrozen);

    if (isFrozen && authState.pubkey) {
        step.style.display = 'block';
        btn.innerHTML = `<span>NO PODÉS<br>APOSTAR</span>`;
        btn.classList.add('frozen');
        btn.onclick = null;
    } else if (!authState.pubkey) {
        step.style.display = 'block';
        btn.textContent = 'JUGAR';
        btn.onclick = () => showLoginModal();
        btn.classList.remove('frozen');
    } else if (state.selectedNumber !== null) {
        step.style.display = 'block';
        btn.textContent = 'APOSTAR';
        btn.classList.remove('frozen');
        btn.onclick = () => (window as any).makePayment();
    } else {
        step.style.display = 'none';
        btn.classList.remove('frozen');
    }
}

export function selectNumber(num: number): void {
    if (!authState.pubkey || document.body.classList.contains('processing')) {
        if (!authState.pubkey) showLoginModal();
        return;
    }
    if (state.selectedNumber === num) return;
    state.selectedNumber = num;
    document.querySelectorAll('.number-segment').forEach(s => {
        const val = parseInt(s.querySelector('.number-text')?.textContent || '0');
        s.classList.toggle('selected', val === num);
    });
    updateCenterButton();
}
