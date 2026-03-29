import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Invalid Signature Security Tests', () => {
    let targetBlock: number;

    beforeAll(async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();
        targetBlock = data.block?.target;
        if (!targetBlock) {
            throw new Error('Could not get target block');
        }
    });

    it('should reject request without signature', async () => {
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: null })
        });
        
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/signature/i);
    });

    it('should reject request with invalid signature', async () => {
        const sk1 = generateSecretKey();
        const pubkey1 = getPublicKey(sk1);
        
        const eventWithWrongSig = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: 7 }),
            pubkey: pubkey1,
            sig: 'invalid_signature_1234567890'
        };
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: eventWithWrongSig })
        });
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid|signature/i);
    });

    it('should reject tampered pubkey after signing', async () => {
        const sk1 = generateSecretKey();
        const sk2 = generateSecretKey();
        const pubkey1 = getPublicKey(sk1);
        const pubkey2 = getPublicKey(sk2);

        const eventForSk1 = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: 7 }),
            pubkey: pubkey1
        };
        
        const signedWithSk1 = finalizeEvent(eventForSk1, sk1);
        const tampered = { ...signedWithSk1, pubkey: pubkey2 };
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: tampered })
        });
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid|signature/i);
    });

    it('should reject malformed JSON in event content', async () => {
        const sk1 = generateSecretKey();
        const pubkey1 = getPublicKey(sk1);
        
        const eventMalformedContent = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: 'not valid json',
            pubkey: pubkey1
        };
        
        const signedMalformed = finalizeEvent(eventMalformedContent, sk1);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signedMalformed })
        });
        
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
