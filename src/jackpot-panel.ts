import { state } from './app-state';

export function createPool(): HTMLElement {
    const jackpotPoolElement = document.createElement('div');
    jackpotPoolElement.id = 'jackpotPool';
    jackpotPoolElement.className = 'pool-panel';
    jackpotPoolElement.innerHTML = `
        <div class="pool-title">POZO ACUMULADO</div>
        <div class="pool-amount">
            <span id="poolSats">0</span> 
            <span class="sats-label">sats</span>
        </div>
    `;
    return jackpotPoolElement;
}

export function updatePool(jackpotBalanceSats: number): void {
    if (state.lastPoolBalance === jackpotBalanceSats) return;
    state.lastPoolBalance = jackpotBalanceSats;

    const poolSatsDisplay = document.getElementById('poolSats');
    if (poolSatsDisplay) {
        poolSatsDisplay.textContent = jackpotBalanceSats.toLocaleString('en-US');
    }
}
