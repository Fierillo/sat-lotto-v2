import { BLOCKS, state } from './app-state';
import { authState } from './auth-state';
import { showLoginModal } from './auth-manager';
import { showFrozenHelpModal } from './frozen-modal';

export function createClock(): HTMLElement {
    const clockContainer = document.createElement('div');
    clockContainer.id = 'clock';
    clockContainer.innerHTML = `
        <div id="outerRing" class="ring"></div>
        <div id="innerCircle" class="inner-ring-container"></div>
        <div id="frozenHelp" class="help-icon">?</div>
        <div id="paymentStep">
            <button id="centerBtn" class="pay-btn"></button>
        </div>
    `;

    const outerRingElement = clockContainer.querySelector('#outerRing') as HTMLElement;
    const innerCircleContainer = clockContainer.querySelector('#innerCircle') as HTMLElement;
    const frozenHelpElement = clockContainer.querySelector('#frozenHelp') as HTMLElement;

    frozenHelpElement.onclick = (e) => {
        showFrozenHelpModal();
        e.stopPropagation();
    };

    // Immediate positioning
    const markerRadius = 230;
    const frozenHelpAngle = (20.5 * 360 / BLOCKS) - 90 - 20;
    const frozenHelpRadian = frozenHelpAngle * Math.PI / 180;
    const frozenHelpRadius = markerRadius + 24;
    const fx = Math.cos(frozenHelpRadian) * frozenHelpRadius;
    const fy = Math.sin(frozenHelpRadian) * frozenHelpRadius;
    frozenHelpElement.style.transform = `translate(-50%, -50%) translate(${fx}px, ${fy}px)`;

    updateClockRings(outerRingElement, innerCircleContainer);

    return clockContainer;
}

export function updateClockRings(outer?: HTMLElement, inner?: HTMLElement): void {
    const ringElement = outer || document.getElementById('outerRing');
    const innerCircleContainer = inner || document.getElementById('innerCircle');
    if (!ringElement || !innerCircleContainer) return;

    const markerRadius = 230;
    const isFirstRender = ringElement.children.length === 0;

    for (let blockIndex = 0; blockIndex < BLOCKS; blockIndex++) {
        const targetBlockNumber = blockIndex === 0 ? state.targetBlock : state.targetBlock - BLOCKS + blockIndex;
        let blockMarkerElement: HTMLElement;

        if (isFirstRender) {
            const rotationDegree = (blockIndex * 360 / BLOCKS) - 90;
            const rotationRadian = rotationDegree * Math.PI / 180;
            const markerXPosition = Math.cos(rotationRadian) * markerRadius;
            const markerYPosition = Math.sin(rotationRadian) * markerRadius;

            blockMarkerElement = document.createElement('div');
            blockMarkerElement.className = 'block-marker';
            blockMarkerElement.style.transform = `translate(-50%, -50%) translate(${markerXPosition}px, ${markerYPosition}px)`;
            ringElement.appendChild(blockMarkerElement);
        } else {
            blockMarkerElement = ringElement.children[blockIndex] as HTMLElement;
        }

        blockMarkerElement.textContent = targetBlockNumber.toString();
        blockMarkerElement.classList.remove('target', 'current', 'neon-blue');
        
        if (blockIndex === 0) {
            blockMarkerElement.classList.add('target');
        } else if (blockIndex === 19 || blockIndex === 20) {
            blockMarkerElement.classList.add('neon-blue');
        }
        
        if (targetBlockNumber === state.currentBlock) blockMarkerElement.classList.add('current');
    }

    const frozenHelpElement = ringElement.parentElement?.querySelector('#frozenHelp') as HTMLElement || document.getElementById('frozenHelp');
    if (frozenHelpElement) {
        const frozenHelpAngle = (20.5 * 360 / BLOCKS) - 90 - 20;
        const frozenHelpRadian = frozenHelpAngle * Math.PI / 180;
        const frozenHelpRadius = markerRadius + 24;
        const fx = Math.cos(frozenHelpRadian) * frozenHelpRadius;
        const fy = Math.sin(frozenHelpRadian) * frozenHelpRadius;
        frozenHelpElement.style.transform = `translate(-50%, -50%) translate(${fx}px, ${fy}px)`;
    }

    if (innerCircleContainer.children.length === 0) {
        for (let numberIndex = 0; numberIndex < BLOCKS; numberIndex++) {
            const segmentRotationDegree = (numberIndex * 360 / BLOCKS);
            const luckNumberToDisplay = numberIndex === 0 ? 21 : numberIndex;

            const numberSegmentElement = document.createElement('div');
            numberSegmentElement.className = 'number-segment';
            numberSegmentElement.style.transform = `translateX(-50%) rotate(${segmentRotationDegree}deg)`;
            numberSegmentElement.onclick = () => selectNumber(luckNumberToDisplay);
            numberSegmentElement.innerHTML = `<div class="number-text" style="transform: rotate(${-segmentRotationDegree}deg)">${luckNumberToDisplay}</div>`;

            innerCircleContainer.appendChild(numberSegmentElement);
        }
    }
}

export function updateCenterButton(): void {
    const paymentStepContainer = document.getElementById('paymentStep');
    const centerActionButton = document.getElementById('centerBtn') as HTMLButtonElement;
    if (!paymentStepContainer || !centerActionButton) return;

    const isFrozen = state.currentBlock >= state.targetBlock - 2;
    document.body.classList.toggle('phase-frozen', isFrozen);

    if (isFrozen && authState.pubkey) {
        paymentStepContainer.style.display = 'block';
        centerActionButton.innerHTML = `<span>NO PODÉS<br>APOSTAR</span>`;
        centerActionButton.classList.add('frozen');
        centerActionButton.onclick = null;
    } else if (!authState.pubkey) {
        paymentStepContainer.style.display = 'block';
        centerActionButton.textContent = 'JUGAR';
        centerActionButton.onclick = () => showLoginModal();
        centerActionButton.classList.remove('frozen');
    } else if (state.selectedNumber !== null) {
        paymentStepContainer.style.display = 'block';
        centerActionButton.textContent = 'APOSTAR';
        centerActionButton.classList.remove('frozen');
        centerActionButton.onclick = () => (window as any).makePayment();
    } else {
        paymentStepContainer.style.display = 'none';
        centerActionButton.classList.remove('frozen');
    }
}

export function selectNumber(selectedLuckNumber: number): void {
    if (!authState.pubkey || document.body.classList.contains('processing')) {
        if (!authState.pubkey) showLoginModal();
        return;
    }

    if (state.selectedNumber === selectedLuckNumber) return;
    state.selectedNumber = selectedLuckNumber;

    document.querySelectorAll('.number-segment').forEach(segmentElement => {
        const numberTextElement = segmentElement.querySelector('.number-text');
        if (numberTextElement) {
            const segmentValue = parseInt(numberTextElement.textContent || '0');
            segmentElement.classList.toggle('selected', segmentValue === selectedLuckNumber);
        }
    });

    updateCenterButton();
}
