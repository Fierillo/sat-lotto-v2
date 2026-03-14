import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import 'dotenv/config';
import { queryNeon } from '../lib/db';

const API_URL = process.env.API_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) { passed++; console.log(`  ✅ ${testName}`); }
    else { failed++; console.log(`  ❌ ${testName}`); }
}

async function testRateLimit() {
    console.log('\n=== HACKER TEST: Rate Limiting ===\n');

    console.log('Fetching current target block...');
    const stateRes = await fetch(`${API_URL}/api/state`);
    const stateData = await stateRes.json();
    const targetBlock = stateData.block?.target;
    if (!targetBlock) {
        console.log('❌ Could not get target block, skipping test');
        return;
    }
    console.log(`Target block: ${targetBlock}\n`);

    console.log('Test 1: State endpoint rate limit (6/min)');
    let stateBlocked = false;
    for (let i = 0; i < 10; i++) {
        const res = await fetch(`${API_URL}/api/state`);
        if (res.status === 429) {
            stateBlocked = true;
            console.log(`  📝 Blocked after ${i + 1} requests`);
            break;
        }
    }
    assert(stateBlocked, 'Should be rate limited after 10 state requests');

    console.log('\nTest 2: Bet endpoint rate limit by pubkey (3/min)');
    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    console.log('  Burning 3 valid requests to consume rate limit...');
    for (let i = 0; i < 3; i++) {
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: i + 1 }),
            pubkey: pubkey
        };
        const signed = finalizeEvent(event, sk);
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        const data = await res.json();
        console.log(`  Request ${i + 1}: ${res.status} - ${data.error || 'OK'}`);
        if (res.status === 429) {
            console.log(`  ⚠️  Rate limited early on request ${i + 1}`);
            break;
        }
    }

    console.log('  Testing rate limit enforcement...');
    let betBlocked = false;
    for (let i = 0; i < 3; i++) {
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: ((i + 10) % 21) + 1 }),
            pubkey: pubkey
        };
        const signed = finalizeEvent(event, sk);
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });

        if (res.status === 429) {
            betBlocked = true;
            console.log(`  📝 Blocked after ${i + 1} additional requests`);
            break;
        }
    }
    assert(betBlocked, 'Should be rate limited after 3 bet requests');

    console.log('\nTest 3: GET /api/bet rate limit');
    let getBlocked = false;
    for (let i = 0; i < 6; i++) {
        const res = await fetch(`${API_URL}/api/bet?block=89021&number=7&pubkey=${pubkey}`);
        if (res.status === 429) {
            getBlocked = true;
            console.log(`  📝 GET blocked after ${i + 1} requests`);
            break;
        }
        
        if (i < 5) await new Promise(r => setTimeout(r, 100));
    }
    assert(getBlocked, 'Should be rate limited on GET /api/bet');

    console.log('\nCleaning up test data...');
    await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
    await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
    console.log('✅ Cleanup complete');

    console.log(`\n=== Rate Limit Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testRateLimit().then(() => process.exit(failed > 0 ? 1 : 0));
