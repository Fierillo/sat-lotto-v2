export function createPool(): HTMLElement {
    const pool = document.createElement('div');
    pool.id = 'jackpotPool';
    pool.className = 'pool-panel';
    pool.innerHTML = `
        <div class="pool-title">POZO ACUMULADO</div>
        <div class="pool-amount"><span id="poolSats">0</span> <span class="sats-label">sats</span></div>
    `;
    return pool;
}

export function updatePool(betsCount: number): void {
    const poolEl = document.getElementById('poolSats');
    if (poolEl) {
        const total = betsCount * 21000;
        poolEl.textContent = total.toLocaleString('en-US');
    }
}
