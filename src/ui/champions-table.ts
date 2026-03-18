import { resolveName } from '../utils/nostr-service';

export function renderChampionsTable(champions: Array<{ pubkey: string; alias?: string; sats_earned: number }>): void {
    const container = document.getElementById('championsTable');
    if (!container) return;

    if (!champions.length) {
        container.innerHTML = '<h3>Hall of Fame</h3><p class="empty-bets">No hay ganadores aún</p>';
        return;
    }

    const tableBody = document.createElement('tbody');
    champions.forEach(winner => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = winner.alias || resolveName(winner.pubkey);
        
        const amountCell = document.createElement('td');
        amountCell.className = 'text-orange';
        amountCell.style.fontWeight = 'bold';
        amountCell.textContent = `${winner.sats_earned.toLocaleString()} sats`;
        
        row.appendChild(nameCell);
        row.appendChild(amountCell);
        tableBody.appendChild(row);
    });

    container.innerHTML = `<h3>🏆 Hall of Fame</h3>`;
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Campeón</th><th>Ganancia</th></tr></thead>`;
    table.appendChild(tableBody);
    container.appendChild(table);
}
