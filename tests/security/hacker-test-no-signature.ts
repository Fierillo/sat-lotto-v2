import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import 'dotenv/config';

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

async function testInvalidSignatures() {
    console.log('\n=== HACKER TEST: Invalid Signature Rejection ===\n');

    const targetBlock = await getTargetBlock();
    if (!targetBlock) {
        console.log('❌ Could not get target block, skipping test');
        return;
    }

    const sk1 = generateSecretKey();
    const sk2 = generateSecretKey();
    const pubkey1 = getPublicKey(sk1);
    const pubkey2 = getPublicKey(sk2);

    console.log(`Testing with target block: ${targetBlock}\n`);

    console.log('Test 1: No signature (empty signedEvent)');
    const res1 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: null })
    });
    const data1 = await res1.json();
    assert(res1.status === 401, 'Request without signature should return 401');
    assert(data1.error?.includes('Signature'), 'Error should mention signature required');

    console.log('\nTest 2: Invalid signature (wrong key)');
    const eventWithWrongSig = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: targetBlock, numero: 7 }),
        pubkey: pubkey1,
        sig: 'invalid_signature_1234567890'
    };
    const res2 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: eventWithWrongSig })
    });
    const data2 = await res2.json();
    assert(res2.status === 400, 'Request with invalid signature should return 400');
    assert(data2.error?.includes('Invalid') || data2.error?.includes('signature'), 'Error should mention invalid signature');

    console.log('\nTest 3: Pubkey tampered after signing');
    const eventForSk1 = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: JSON.stringify({ bloque: targetBlock, numero: 7 }),
        pubkey: pubkey1
    };
    const signedWithSk1 = finalizeEvent(eventForSk1, sk1);
    const tampered = { ...signedWithSk1, pubkey: pubkey2 };
    console.log(`  Original pubkey: ${pubkey1.slice(0, 10)}...`);
    console.log(`  Tampered pubkey: ${pubkey2.slice(0, 10)}...`);
    console.log(`  Signature still valid for: ${pubkey1.slice(0, 10)}...`);
    const res3 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: tampered })
    });
    const data3 = await res3.json();
    assert(res3.status === 400, 'Request with tampered pubkey should return 400');
    assert(data3.error?.includes('Invalid') || data3.error?.includes('signature'), 'Error should mention invalid signature');

    console.log('\nTest 4: Malformed JSON in event content');
    const eventMalformedContent = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'satlotto']],
        content: 'not valid json',
        pubkey: pubkey1
    };
    const signedMalformed = finalizeEvent(eventMalformedContent, sk1);
    const res4 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: signedMalformed })
    });
    const data4 = await res4.json();
    assert(res4.status === 500 || data4.error, 'Request with malformed content should fail');

    console.log(`\n=== Invalid Signature Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testInvalidSignatures().then(() => process.exit(failed > 0 ? 1 : 0));
