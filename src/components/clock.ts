import { BLOCKS, state } from './state';
import { authState, showLoginModal } from './auth';

export function createClock(): HTMLElement {
    const clock = document.createElement('div');
    clock.id = 'clock';

    const outerRing = document.createElement('div');
    outerRing.id = 'outerRing';
    outerRing.className = 'ring';

    const innerCircle = document.createElement('div');
    innerCircle.id = 'innerCircle';
    innerCircle.className = 'inner-ring-container';

    const paymentStep = document.createElement('div');
    paymentStep.id = 'paymentStep';

    const btn = document.createElement('button');
    btn.id = 'centerBtn';
    btn.className = 'pay-btn';
    paymentStep.appendChild(btn);

    clock.appendChild(outerRing);
    clock.appendChild(innerCircle);
    clock.appendChild(paymentStep);

    updateClockRings(outerRing, innerCircle);

    return clock;
}

export function updateClockRings(outer?: HTMLElement, inner?: HTMLElement): void {
    const ring = outer || document.getElementById('outerRing');
    const container = inner || document.getElementById('innerCircle');
    if (!ring || !container) return;

    // Outer Ring
    const radius = 230;
    const isNew = ring.children.length === 0;

    for (let i = 0; i < BLOCKS; i++) {
        const blockNum = i === 0 ? state.targetBlock : state.targetBlock - BLOCKS + i;
        let marker: HTMLElement;

        if (isNew) {
            marker = document.createElement('div');
            const deg = (i * 360 / BLOCKS) - 90;
            const rad = deg * Math.PI / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;
            marker.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            ring.appendChild(marker);
        } else {
            marker = ring.children[i] as HTMLElement;
        }

        marker.className = 'block-marker';
        marker.textContent = blockNum.toString();

        if (i === 0) marker.classList.add('target');
        if (blockNum === state.currentBlock) marker.classList.add('current');
    }

    // Inner Ring (only if empty)
    if (container.children.length === 0) {
        for (let i = 0; i < BLOCKS; i++) {
            const deg = (i * 360 / BLOCKS);
            const displayNum = i === 0 ? 21 : i;

            const segment = document.createElement('div');
            segment.className = 'number-segment';
            segment.style.transform = `translateX(-50%) rotate(${deg}deg)`;
            segment.onclick = () => selectNumber(displayNum);

            const text = document.createElement('div');
            text.className = 'number-text';
            text.textContent = displayNum.toString();
            text.style.transform = `rotate(${-deg}deg)`;

            segment.appendChild(text);
            container.appendChild(segment);
        }
    }
}

export function updateCenterButton(): void {
    const step = document.getElementById('paymentStep');
    const btn = document.getElementById('centerBtn') as HTMLButtonElement;
    if (!step || !btn) return;

    if (!authState.pubkey) {
        step.style.display = 'block';
        btn.textContent = 'JUGAR';
        btn.onclick = () => showLoginModal();
    } else {
        if (state.selectedNumber !== null) {
            step.style.display = 'block';

            btn.textContent = 'APOSTAR';
            btn.style.fontSize = '1em';

            btn.onclick = () => (window as any).makePayment();
        } else {
            step.style.display = 'none';
        }
    }
}

export function selectNumber(num: number): void {
    if (!authState.pubkey || document.body.classList.contains('processing')) {
        if (!authState.pubkey) showLoginModal();
        return;
    }

    if (state.selectedNumber === num) return;
    state.selectedNumber = num;

    document.querySelectorAll('.number-segment').forEach(seg => {
        const txt = seg.querySelector('.number-text');
        if (txt) {
            seg.classList.toggle('selected', parseInt(txt.textContent || '0') === num);
        }
    });

    updateCenterButton();
}
