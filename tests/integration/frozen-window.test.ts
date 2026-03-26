import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Frozen Window Integration Tests', () => {
    it('should reject bet on past blocks', async () => {
        const sk = generateSecretKey();
        const pubkey = getPublicKey(sk);
        
        const stateRes = await fetch(`${API_URL}/api/state`);
        if (stateRes.status === 429) {
            return;
        }
        
        const state = await stateRes.json();
        const pastBlock = state.block.target - 10;

        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({
                bloque: pastBlock,
                numero: 9
            }),
            pubkey: pubkey
        };

        const signed = finalizeEvent(event, sk);

        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return correct block information', async () => {
        const res = await fetch(`${API_URL}/api/state`);
        
        if (res.status === 429) {
            return;
        }
        
        const data = await res.json();
        expect(data.block.height).toBeGreaterThan(0);
        expect(data.block.target).toBeGreaterThan(data.block.height);
    });
});
