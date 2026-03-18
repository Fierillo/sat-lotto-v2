import { state } from '../app-state';
import { showTransparencyHelpModal } from './help-modals';

export function createPool(): HTMLElement {
    const jackpotPoolElement = document.createElement('div');
    jackpotPoolElement.id = 'jackpotPool';
    jackpotPoolElement.className = 'pool-panel';
    jackpotPoolElement.innerHTML = `
        <div class="pool-title">
            POZO ACUMULADO 
            <span class="help-icon" id="poolHelp" style="margin-left: 5px;">?</span>
        </div>
        <div class="pool-amount">
            <span id="poolSats">0</span> 
            <span class="sats-label">sats</span>
        </div>
    `;
    jackpotPoolElement.querySelector('#poolHelp')?.addEventListener('click', (e) => {
        showTransparencyHelpModal();
        e.stopPropagation();
    });
    return jackpotPoolElement;
}

export function updatePool(jackpotBalanceSats: number): void {
    if (state.lastPoolBalance === jackpotBalanceSats) return;
    state.lastPoolBalance = jackpotBalanceSats;

    const poolSatsDisplay = document.getElementById('poolSats');
    if (poolSatsDisplay) {
        poolSatsDisplay.textContent = jackpotBalanceSats.toLocaleString('en-US');
        
        // Glow effect
        const amountContainer = poolSatsDisplay.parentElement;
        if (amountContainer) {
            amountContainer.classList.add('update-glow');
            setTimeout(() => amountContainer.classList.remove('update-glow'), 1000);
        }
    }
}
