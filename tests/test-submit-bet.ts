import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import 'dotenv/config';
import { queryNeon } from '../lib/db';

async function testSubmitBet() {
    console.log('[Test] Testing consolidated POST /api/bet...');

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    const targetBlock = 999999; // Using a high block number for testing
    const selectedNumber = 7;

    console.log(`[Test] Generated random pubkey: ${pubkey.slice(0, 10)}...`);

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
        const response = await fetch('http://localhost:3000/api/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent, testMode: true })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[Error] Server response (${response.status}):`, data.error);
            return;
        }

        console.log(`[Success] Bet accepted. Hash: ${data.paymentHash?.slice(0, 15)}...`);
        console.log('[Test] Verifying in DB via /api/state...');

        await verifySavedBet(targetBlock, pubkey);

        // Cleanup: remove the test bet to keep DB clean
        console.log('[Test] Cleaning up test data...');
        await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1 AND target_block = $2', [pubkey, targetBlock]);
        await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        console.log('✅ Cleanup complete.');

    } catch (error: any) {
        console.error('[Error] Fetch failed:', error.message);
        console.log('💡 Is the local server running on port 3000?');
    }
}

async function verifySavedBet(block: number, expectedPubkey: string) {
    try {
        const response = await fetch(`http://localhost:3000/api/state`);
        const data = await response.json();

        const bets = data.activeBets || [];
        const found = bets.find((b: any) => b.pubkey === expectedPubkey);
        
        if (found) {
            console.log(`[Success] Bet found in Hall of Fame/Active bets!`);
        } else {
            console.error('[Fail] Bet not found in state. (Note: state only shows bets for current target block)');
        }

    } catch (error: any) {
        console.error('[Error] DB verification failed:', error.message);
    }
}

testSubmitBet();
