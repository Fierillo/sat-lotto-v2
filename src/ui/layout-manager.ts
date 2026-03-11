export function drawDashboardElements(container: HTMLElement): void {
    const betsPanel = document.createElement('div');
    betsPanel.id = 'betsTable';
    betsPanel.className = 'bets-panel';
    
    const clockInfoPanel = document.createElement('div');
    clockInfoPanel.id = 'clockInfo';
    
    const lastResultPanel = document.createElement('div');
    lastResultPanel.id = 'lastResult';
    lastResultPanel.className = 'result-panel';

    const championsPanel = document.createElement('div');
    championsPanel.id = 'championsTable';
    championsPanel.className = 'bets-panel';

    container.appendChild(betsPanel);
    container.appendChild(championsPanel);
    container.appendChild(clockInfoPanel);
    container.appendChild(lastResultPanel);
}
