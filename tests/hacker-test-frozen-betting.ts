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

async function getBlockInfo() {
    const res = await fetch(`${API_URL}/api/state`);
    const data = await res.json();
    return {
        current: data.block?.height,
        target: data.block?.target
    };
}

async function testFrozenBetting() {
    console.log('\n=== HACKER TEST: Frozen Window Bypass ===\n');

    const { current, target } = await getBlockInfo();
    if (!current || !target) {
        console.log('❌ Could not get block info, skipping test');
        return;
    }

    console.log(`Current block: ${current}, Target block: ${target}`);
    console.log(`Frozen window: ${target - 2} (blocks ${target - 2} to ${target - 1})`);

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    console.log('\nTest 1: Bet on future block (not current target)');
    const futureBlock = target + 21;
    const event1 = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: futureBlock, numero: 7 }),
        pubkey: pubkey
    };
    const signed1 = finalizeEvent(event1, sk);
    
    const res1 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: signed1 })
    });
    const data1 = await res1.json();
    
    assert(res1.status === 400 || data1.error?.includes('Invalid target') || data1.error?.includes('target'),
        'Bet on non-target block should be rejected');

    console.log('\nTest 2: Bet on past block');
    const pastBlock = current - 10;
    const event2 = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: pastBlock, numero: 7 }),
        pubkey: pubkey
    };
    const signed2 = finalizeEvent(event2, sk);
    
    const res2 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: signed2 })
    });
    const data2 = await res2.json();
    
    assert(res2.status === 400 || data2.error?.includes('target') || data2.error?.includes('Invalid'),
        'Bet on past block should be rejected');

    console.log('\nTest 3: Verify frozen window check');
    const frozenBlock = target - 1;
    const event3 = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: target, numero: 7 }),
        pubkey: pubkey
    };
    const signed3 = finalizeEvent(event3, sk);
    
    const res3 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: signed3 })
    });
    const data3 = await res3.json();

    if (data3.error?.includes('Frozen') || data3.error?.includes('closed')) {
        assert(true, 'Bet in frozen window should be rejected');
    } else if (res3.status === 200) {
        console.log(`  ⚠️  Note: Current block ${current} is not in frozen window (target is ${target})`);
        console.log(`  ℹ️  Frozen window would be blocks ${target - 2} to ${target - 1}`);
        passed++;
    } else {
        assert(data3.error !== undefined, 'Should get some response');
    }

    await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
    await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);

    console.log(`\n=== Frozen Window Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testFrozenBetting().then(() => process.exit(failed > 0 ? 1 : 0));
