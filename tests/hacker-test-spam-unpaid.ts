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

async function testUnpaidSpam() {
    console.log('\n=== HACKER TEST: Unpaid Invoice Spam ===\n');

    const targetBlock = await getTargetBlock();
    if (!targetBlock) {
        console.log('❌ Could not get target block, skipping test');
        return;
    }

    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    console.log(`Testing with pubkey: ${pubkey.slice(0, 10)}...`);
    console.log(`Target block: ${targetBlock}`);
    console.log('\nCreating 10 unpaid invoices...\n');

    let rejected = 0;
    let created = 0;

    for (let i = 0; i < 10; i++) {
        const num = (i % 21) + 1;
        
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: num }),
            pubkey: pubkey
        };
        
        const signed = finalizeEvent(event, sk);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        
        const data = await res.json();
        
        if (res.status === 429 || data.error?.includes('unpaid')) {
            rejected++;
            console.log(`  Request ${i + 1}: REJECTED (${data.error || '429'})`);
        } else if (res.status === 200 || res.status === 409) {
            created++;
            console.log(`  Request ${i + 1}: CREATED or DUPLICATE (${res.status})`);
        } else {
            console.log(`  Request ${i + 1}: ${res.status} - ${data.error || 'OK'}`);
        }

        await new Promise(r => setTimeout(r, 50));
    }

    console.log(`\nResults: ${created} created/accepted, ${rejected} rejected`);
    assert(rejected >= 1, 'Should reject at least one request after 5 unpaid');
    assert(created <= 5, 'Should not create more than 5 unpaid invoices');

    console.log('\nCleaning up test data...');
    await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
    await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
    console.log('✅ Cleanup complete');

    console.log(`\n=== Unpaid Invoice Spam Tests Complete: ${passed} passed, ${failed} failed ===\n`);
}

testUnpaidSpam().then(() => process.exit(failed > 0 ? 1 : 0));
