export function createLeftDashboard(): HTMLElement {
    const leftDashboardContainer = document.createElement('div');
    leftDashboardContainer.id = 'leftDashboard';
    leftDashboardContainer.innerHTML = '<div id="betsTable" class="bets-panel" style="margin-top: 0"></div>';
    return leftDashboardContainer;
}

export function createRightDashboard(): HTMLElement {
    const rightDashboardContainer = document.createElement('div');
    rightDashboardContainer.id = 'rightDashboard';
    rightDashboardContainer.innerHTML = `
        <div id="clockInfo"></div>
        <div id="lastResult" class="result-panel"></div>
    `;
    return rightDashboardContainer;
}
