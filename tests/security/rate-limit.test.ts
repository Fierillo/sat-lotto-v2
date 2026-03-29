import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { queryNeon } from '../../src/lib/db';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Rate Limit Security Tests', () => {
    let targetBlock: number;

    beforeAll(async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();
        targetBlock = data.block?.target;
        if (!targetBlock) {
            throw new Error('Could not get target block');
        }
    });

    it('should rate limit state endpoint', async () => {
        let blocked = false;
        for (let i = 0; i < 10; i++) {
            const res = await fetch(`${API_URL}/api/state`);
            if (res.status === 429) {
                blocked = true;
                break;
            }
        }
        expect(blocked).toBe(true);
    });

    it('should rate limit bet endpoint by pubkey', async () => {
        const sk = generateSecretKey();
        const pubkey = getPublicKey(sk);

        for (let i = 0; i < 3; i++) {
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', 'satlotto']],
                content: JSON.stringify({ bloque: targetBlock, numero: i + 1 }),
                pubkey: pubkey
            };
            const signed = finalizeEvent(event, sk);
            await fetch(`${API_URL}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent: signed })
            });
        }

        let blocked = false;
        for (let i = 0; i < 3; i++) {
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', 'satlotto']],
                content: JSON.stringify({ bloque: targetBlock, numero: i + 10 }),
                pubkey: pubkey
            };
            const signed = finalizeEvent(event, sk);
            const res = await fetch(`${API_URL}/api/bet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent: signed })
            });
            if (res.status === 429) {
                blocked = true;
                break;
            }
        }

        await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
        await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        
        expect(blocked).toBe(true);
    });

    it('should rate limit GET bet endpoint', async () => {
        const sk = generateSecretKey();
        const pubkey = getPublicKey(sk);
        
        let blocked = false;
        for (let i = 0; i < 6; i++) {
            const res = await fetch(`${API_URL}/api/bet?block=89021&number=7&pubkey=${pubkey}`);
            if (res.status === 429) {
                blocked = true;
                break;
            }
            if (i < 5) await new Promise(r => setTimeout(r, 100));
        }
        
        expect(blocked).toBe(true);
    });
});
