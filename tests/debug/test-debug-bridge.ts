async function testDebugBridge() {
    console.log('--- Testing Debug Bridge ---');
    try {
        const response = await fetch('http://localhost:5173/api/debug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                msg: 'TEST_PING',
                timestamp: new Date().toISOString(),
                ua: 'TestScript/NodeJS'
            })
        });

        if (response.ok) {
            console.log('✅ Success: Test log sent to server.');
            console.log('Check tests/mobile_debug.log to verify receipt.');
        } else {
            console.error('❌ Failure:', response.status, response.statusText);
        }
    } catch (e: any) {
        console.error('❌ Error connecting to server:', e.message);
        console.log('Ensure the server is running on port 5173.');
    }
}

testDebugBridge();
