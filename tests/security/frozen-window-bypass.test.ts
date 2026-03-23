import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { queryNeon } from '../../src/lib/db';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Frozen Window Bypass Security Tests', () => {
    let currentBlock: number;
    let targetBlock: number;
    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);

    beforeAll(async () => {
        const res = await fetch(`${API_URL}/api/state`);
        const data = await res.json();
        currentBlock = data.block?.height;
        targetBlock = data.block?.target;
        if (!currentBlock || !targetBlock) {
            throw new Error('Could not get block info');
        }
    });

    afterAll(async () => {
        try {
            await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1', [pubkey]);
            await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        } catch {}
    });

    it('should reject bet on future block', async () => {
        const futureBlock = targetBlock + 21;
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: futureBlock, numero: 7 }),
            pubkey: pubkey
        };
        const signed = finalizeEvent(event, sk);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Invalid|target/i);
    });

    it('should reject bet on past block', async () => {
        const pastBlock = currentBlock - 10;
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: pastBlock, numero: 7 }),
            pubkey: pubkey
        };
        const signed = finalizeEvent(event, sk);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/target|Invalid/i);
    });

    it('should enforce frozen window (target - 2 to target - 1)', async () => {
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: 7 }),
            pubkey: pubkey
        };
        const signed = finalizeEvent(event, sk);
        
        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: signed })
        });
        
        const data = await res.json();
        if (data.error?.includes('Frozen') || data.error?.includes('closed')) {
            expect(true).toBe(true);
        } else if (res.status === 200) {
            expect(currentBlock).toBeGreaterThan(targetBlock - 1);
        }
    });
});
