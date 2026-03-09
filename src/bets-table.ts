import { resolveName } from './utils/nostr-service';
import { state } from './app-state';

export function renderBetsTable(activeBets: Array<{ pubkey: string; selected_number: number; alias?: string }>): void {
    const betsTableContainer = document.getElementById('betsTable');
    if (!betsTableContainer) return;

    // Redundancy Check: Compare JSON strings to avoid touching the DOM
    const currentBetsJson = JSON.stringify(activeBets);
    if (currentBetsJson === state.lastBetsJson) return;
    state.lastBetsJson = currentBetsJson;

    if (!activeBets.length) {
        betsTableContainer.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>';
        return;
    }

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
