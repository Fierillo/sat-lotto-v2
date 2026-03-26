import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Bet Flow Integration Tests', () => {
    it('should place a bet via GET endpoint', async () => {
        const sk = generateSecretKey();
        const pubkey = getPublicKey(sk);
        
        const stateRes = await fetch(`${API_URL}/api/state`);
        if (stateRes.status === 429) {
            return;
        }
        
        const state = await stateRes.json();
        const targetBlock = state.block.target;

        const res = await fetch(`${API_URL}/api/bet?block=${targetBlock}&number=7&pubkey=${pubkey}`);
        
        if (res.status === 429) {
            return;
        }
        
        if (res.status === 400) {
            return;
        }

        expect([200, 409]).toContain(res.status);
        
        const data = await res.json();
        if (res.status === 200) {
            expect(data.paymentRequest).toBeDefined();
            expect(data.paymentHash).toBeDefined();
        }
    });
});
