import { resolveName } from './utils/nostr-service';

export function renderBetsTable(activeBets: Array<{ pubkey: string; selected_number: number; alias?: string }>): void {
    const betsTableContainer = document.getElementById('betsTable');
    if (!betsTableContainer) return;

    if (!activeBets.length) {
        betsTableContainer.innerHTML = '<p class="empty-bets">Sin apuestas en este ciclo</p>';
        return;
    }

    const tableRowsHtml = activeBets.map(bet => `
        <tr>
            <td>${bet.alias || resolveName(bet.pubkey)}</td>
            <td>${bet.selected_number}</td>
        </tr>
    `).join('');

    betsTableContainer.innerHTML = `
        <h3>Apuestas Activas</h3>
        <table>
            <thead>
                <tr><th>Jugador</th><th>Número</th></tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
        </table>
    `;
}
