import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { queryNeon } from '../../src/lib/db';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Replay Attack Security Tests', () => {
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
            await queryNeon('DELETE FROM lotto_bets WHERE pubkey = $1 AND target_block = $2', [pubkey, targetBlock]);
            await queryNeon('DELETE FROM lotto_identities WHERE pubkey = $1', [pubkey]);
        } catch {}
    });

    it('should reject replayed bet events', async () => {
        const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: 7, alias: 'ReplayTest' }),
            pubkey: pubkey
        };

        const signedEvent = finalizeEvent(eventTemplate, sk);

        const res1 = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        const res2 = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent })
        });

        expect(res2.status).toBe(409);
        expect((await res2.json()).error).toMatch(/replay|ya.*procesada/i);
    });
});
