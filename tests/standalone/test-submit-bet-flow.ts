import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import 'dotenv/config';
import { queryNeon } from '../src/lib/db';

async function testSubmitBet() {
    console.log('[Test] Fetching current game state to get target block...');

    let targetBlock: number;
    try {
        const stateRes = await fetch('http://localhost:3000/api/state');
        const stateData = await stateRes.json();
        targetBlock = stateData.block?.target;
        
        if (!targetBlock) {
            console.error('[Error] Could not get target block from state');
            return;
        }
        console.log(`[Test] Target block: ${targetBlock}`);
    } catch (e: any) {
        console.error('[Error] Failed to fetch game state:', e.message);
        console.log('💡 Is the local server running on port 3000?');
        return;
    }

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    const selectedNumber = Math.floor(Math.random() * 21) + 1;

    console.log(`[Test] Generated random pubkey: ${pubkey.slice(0, 10)}...`);
    console.log(`[Test] Selected number: ${selectedNumber}`);

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ 
            bloque: targetBlock, 
            numero: selectedNumber,
            alias: 'TestBot'
        }),
        pubkey: pubkey
    };

    const signedEvent = finalizeEvent(eventTemplate, sk);

    try {
        console.log('[Test] Submitting bet to /api/bet...');
        const response = await fetch('http://localhost:3000/api/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[Error] Server response (${response.status}):`, data.error);
            if (data.error?.includes('Rate limit')) {
                console.log('[Info] Rate limited. This is expected if you run the test too frequently.');
            }
            return;
        }

        if (!data.paymentRequest || !data.paymentHash) {
            console.error('[Error] Server returned incomplete response:', data);
            return;
        }

        console.log(`[Success] Bet accepted. Payment hash: ${data.paymentHash.slice(0, 15)}...`);
        console.log(`[Test] Invoice created successfully (would need payment to confirm)`);

        console.log('[Test] Cleaning up test data...');
        await queryNeon(
            'DELETE FROM lotto_bets WHERE pubkey = $1 AND target_block = $2',
            [pubkey, targetBlock]
        );
        await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        console.log('✅ Test completed and cleaned up.');

    } catch (error: any) {
        console.error('[Error] Fetch failed:', error.message);
        console.log('💡 Is the local server running on port 3000?');
    }
}

testSubmitBet();
