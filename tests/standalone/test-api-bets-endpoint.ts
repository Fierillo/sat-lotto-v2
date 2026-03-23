async function checkBetsEndpoint() {
    try {
        const response = await fetch('http://localhost:5173/api/bets?block=892341');
        const data = await response.json();
        console.log('GET /api/bets:', data);
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

checkBetsEndpoint();
