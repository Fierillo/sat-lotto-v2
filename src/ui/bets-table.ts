import { resolveName } from '../utils/nostr-service';
import { state } from '../app-state';

export function renderBetsTable(activeBets: Array<{ pubkey: string; selected_number: number; alias?: string }>): void {
    const betsTableContainer = document.getElementById('betsTable');
    if (!betsTableContainer) return;

    if (!activeBets.length) {
        betsTableContainer.innerHTML = '<h3>Apuestas Activas</h3><p class="empty-bets">Sin apuestas en este ciclo</p>';
        state.lastBetsJson = '[]';
        return;
    }

    // Redundancy Check: Only skip if we already have content and it's identical
    const currentBetsJson = JSON.stringify(activeBets);
    if (currentBetsJson === state.lastBetsJson && betsTableContainer.children.length > 0) return;
    state.lastBetsJson = currentBetsJson;

    const tableBody = document.createElement('tbody');
    activeBets.forEach(bet => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = bet.alias || resolveName(bet.pubkey);
        
        const numCell = document.createElement('td');
        numCell.textContent = bet.selected_number.toString();
        
        row.appendChild(nameCell);
        row.appendChild(numCell);
        tableBody.appendChild(row);
    });

    betsTableContainer.innerHTML = `<h3>Apuestas Activas</h3>`;
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Jugador</th><th>Número</th></tr></thead>`;
    table.appendChild(tableBody);
    betsTableContainer.appendChild(table);
}
