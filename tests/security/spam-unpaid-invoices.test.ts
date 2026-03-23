import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { queryNeon } from '../../src/lib/db';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Spam Unpaid Invoices Security Tests', () => {
    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    let targetBlock: number;

    beforeAll(async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();
        targetBlock = data.block?.target;
        if (!targetBlock) {
            throw new Error('Could not get target block');
        }
    });

    afterAll(async () => {
        try {
            await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
            await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        } catch {}
    });

    it('should limit unpaid invoices to 5 per pubkey', async () => {
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
            } else if (res.status === 200 || res.status === 409) {
                created++;
            }

            await new Promise(r => setTimeout(r, 50));
        }

        expect(rejected).toBeGreaterThanOrEqual(1);
        expect(created).toBeLessThanOrEqual(5);
    });
});
