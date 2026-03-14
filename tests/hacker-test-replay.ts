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

async function getTargetBlock(): Promise<number> {
    const res = await fetch(`${API_URL}/api/state`);
    const data = await res.json();
    return data.block?.target;
}

async function testReplayAttack() {
    console.log('\n=== HACKER TEST: Replay Attack Protection ===\n');

    const targetBlock = await getTargetBlock();
    if (!targetBlock) {
        console.log('❌ Could not get target block, skipping test');
        return;
    }

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: targetBlock, numero: 7, alias: 'ReplayTest' }),
        pubkey: pubkey
    };

    const signedEvent = finalizeEvent(eventTemplate, sk);
    console.log(`Testing with pubkey: ${pubkey.slice(0, 10)}...`);
    console.log(`Target block: ${targetBlock}`);

    try {
        const res1 = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        const data1 = await res1.json();

        if (res1.status === 200 || data1.error?.includes('paid bet')) {
            console.log(`  📝 First attempt: ${res1.status} - ${data1.error || 'OK'}`);
        } else {
            console.log(`  📝 First attempt: ${res1.status} - ${data1.error}`);
        }

        const res2 = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        const data2 = await res2.json();
        console.log(`  📝 Second attempt (replay): ${res2.status} - ${data2.error || 'OK'}`);

        assert(res2.status === 409 || data2.error?.includes('ya fue procesada'), 'Replays should be rejected with 409');
        assert(data2.error?.includes('Replay'), 'Error should mention replay protection');

        await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1 AND target_block = $2', [pubkey, targetBlock]);
        await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);

    } catch (err: any) {
        console.log(`  ❌ Test error: ${err.message}`);
        failed++;
    }

    console.log(`\n=== Replay Test Complete: ${passed} passed, ${failed} failed ===\n`);
}

testReplayAttack().then(() => process.exit(failed > 0 ? 1 : 0));
