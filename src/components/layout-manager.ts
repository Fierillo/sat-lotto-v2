export function drawDashboardElements(container: HTMLElement): void {
    const betsPanel = document.createElement('div');
    betsPanel.id = 'betsTable';
    betsPanel.className = 'bets-panel';
    
    const clockInfoPanel = document.createElement('div');
    clockInfoPanel.id = 'clockInfo';
    
    const lastResultPanel = document.createElement('div');
    lastResultPanel.id = 'lastResult';
    lastResultPanel.className = 'result-panel';

    container.appendChild(betsPanel);
    container.appendChild(clockInfoPanel);
    container.appendChild(lastResultPanel);
}
