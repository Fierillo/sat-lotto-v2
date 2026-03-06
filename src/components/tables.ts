export function createDashboard(): HTMLElement {
    const db = document.createElement('div');
    db.id = 'dashboard';
    db.innerHTML = `
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
        <div id="betsTable" class="bets-panel"></div>
    `;
    return db;
}

export function renderBetsTable(bets: Array<{ pubkey: string; selected_number: number }>): void {
    const el = document.getElementById('betsTable');
    if (!el) return;
    if (!bets.length) { el.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>'; return; }

    const rows = bets.map(b => `<tr><td>${b.pubkey.slice(0, 8)}…</td><td>${b.selected_number}</td></tr>`).join('');
    el.innerHTML = `<h3>Apuestas Activas</h3><table><thead><tr><th>Jugador</th><th>Número</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderResult(result: any): void {
    const el = document.getElementById('lastResult');
    if (!el) return;
    if (!result || !result.resolved) { el.innerHTML = ''; return; }

    const winnersText = result.winners?.length ? result.winners.map((w: any) => `${w.pubkey.slice(0, 8)}…`).join(', ') : 'Nadie';
    el.innerHTML = `<h3>Último Sorteo</h3><p>Número ganador: <strong class="text-orange">${result.winningNumber}</strong></p><p>Ganadores: <strong>${winnersText}</strong></p>`;
}
