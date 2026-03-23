import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Input Validation Security Tests', () => {
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

    const invalidNumbers = [
        { num: 0, desc: 'Number 0 (out of range)' },
        { num: 22, desc: 'Number 22 (out of range)' },
        { num: -1, desc: 'Negative number' },
        { num: 100, desc: 'Number 100 (way out of range)' },
        { num: 0.5, desc: 'Decimal number 0.5' },
        { num: null, desc: 'Null number' },
    ];

    for (const test of invalidNumbers) {
        it(`should reject ${test.desc}`, async () => {
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
            expect(res.status).toBe(400);
            expect(data.error).toMatch(/number|Invalid/i);
        });
    }

    it('should reject GET with number 0', async () => {
        const res = await fetch(`${API_URL}/api/bet?block=89021&number=0&pubkey=${pubkey}`);
        expect(res.status).toBe(400);
    });

    it('should reject GET with number out of range', async () => {
        const res = await fetch(`${API_URL}/api/bet?block=89021&number=25&pubkey=${pubkey}`);
        expect(res.status).toBe(400);
    });

    it('should reject request without proper event', async () => {
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: { kind: 1 } })
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject GET without number and pubkey', async () => {
        const res = await fetch(`${API_URL}/api/bet?block=89021`);
        expect(res.status).toBe(400);
    });
});
