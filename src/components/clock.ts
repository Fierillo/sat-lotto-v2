import { BLOCKS, state } from './state';

export function renderOuterRing(): void {
    const ring = document.getElementById('outerRing') as HTMLElement;
    if (!ring) return;
    ring.innerHTML = '';
    const radius = 230;

    for (let i = 0; i < BLOCKS; i++) {
        const deg = (i * 360 / BLOCKS) - 90;
        const rad = deg * Math.PI / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;

        const blockNum = i === 0 ? state.targetBlock : state.targetBlock - BLOCKS + i;
        const marker = document.createElement('div');
        marker.className = 'block-marker';
        marker.textContent = blockNum.toString();

        if (i === 0) marker.classList.add('target');
        if (blockNum === state.currentBlock) marker.classList.add('current');

        marker.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        ring.appendChild(marker);
    }
}

export function renderInnerRing(): void {
    const container = document.getElementById('innerCircle') as HTMLElement;
    if (!container) return;
    container.innerHTML = '';

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

export function selectNumber(num: number): void {
    if (state.selectedNumber === num) return;
    state.selectedNumber = num;

    document.querySelectorAll('.number-segment').forEach(seg => {
        const txt = seg.querySelector('.number-text');
        if (txt) {
            seg.classList.toggle('selected', parseInt(txt.textContent || '0') === num);
        }
    });

    const step = document.getElementById('paymentStep') as HTMLElement;
    if (step) step.style.display = 'block';
}
