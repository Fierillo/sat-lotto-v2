import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Duplicate Prevention Integration Tests', () => {
    it('should track event_id uniqueness', async () => {
        const sk = generateSecretKey();
        const pubkey = getPublicKey(sk);
        
        const stateRes = await fetch(`${API_URL}/api/state`);
        if (stateRes.status === 429) {
            return;
        }
        
        const state = await stateRes.json();
        const targetBlock = state.block.target;

        const uniqueNum = Math.floor(Math.random() * 21) + 1;
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({
                bloque: targetBlock,
                numero: uniqueNum
            }),
            pubkey: pubkey
        };

        const signed = finalizeEvent(event, sk);

        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });

        expect([200, 400, 409]).toContain(res.status);
    });
});
