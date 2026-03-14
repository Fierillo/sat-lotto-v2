import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) { passed++; console.log(`  ✅ ${testName}`); }
    else { failed++; console.log(`  ❌ ${testName}`); }
}

async function testInputValidation() {
    console.log('\n=== HACKER TEST: Input Validation ===\n');

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    async function getTargetBlock(): Promise<number> {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();
        return data.block?.target;
    }

    const targetBlock = await getTargetBlock();

    const tests = [
        { num: 0, desc: 'Number 0 (out of range)' },
        { num: 22, desc: 'Number 22 (out of range)' },
        { num: -1, desc: 'Negative number' },
        { num: 100, desc: 'Number 100 (way out of range)' },
        { num: 0.5, desc: 'Decimal number 0.5' },
        { num: null, desc: 'Null number' },
    ];

    for (const test of tests) {
        console.log(`Test: ${test.desc}`);
        
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ 
                bloque: targetBlock, 
                numero: test.num 
            }),
            pubkey: pubkey
        };
        
        const signed = finalizeEvent(event, sk);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        
        const data = await res.json();
        
        assert(
            res.status === 400 || data.error?.includes('number') || data.error?.includes('Invalid'),
            `${test.desc} should be rejected`
        );
    }

    console.log('\nTest: GET with invalid number');
    const res1 = await fetch(`${API_URL}/api/bet?block=89021&number=0&pubkey=${pubkey}`);
    assert(res1.status === 400, 'GET with number 0 should be rejected');

    const res2 = await fetch(`${API_URL}/api/bet?block=89021&number=25&pubkey=${pubkey}`);
    assert(res2.status === 400, 'GET with number 25 should be rejected');

    console.log('\nTest: Missing parameters');
    const res3 = await fetch(`${API_URL}/api/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedEvent: { kind: 1 } })
    });
    const data3 = await res3.json();
    assert(res3.status >= 400, 'Request without proper event should fail');

    console.log('\nTest: GET missing parameters');
    const res4 = await fetch(`${API_URL}/api/bet?block=89021`);
    const data4 = await res4.json();
    assert(res4.status === 400, 'GET without number and pubkey should fail');

    console.log(`\n=== Input Validation Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testInputValidation().then(() => process.exit(failed > 0 ? 1 : 0));
