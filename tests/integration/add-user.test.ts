import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { queryNeon } from '../../src/lib/db';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Add User to lotto_identities', () => {
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

    it('should create user in lotto_identities via bet with nip05', async () => {
        const event = finalizeEvent({
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'satlotto']],
            content: JSON.stringify({ bloque: targetBlock, numero: 7, nip05: 'testuser@dummy.com' })
        }, sk);

        const res = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedEvent: event })
        });

        expect(res.ok).toBe(true);

        const identityRes = await fetch(`${API_URL}/api/identity/${pubkey}`);
        const identity = await identityRes.json();

        expect(identity.nip05).toBe('testuser@dummy.com');
        expect(identity.pubkey).toBe(pubkey);
        expect(identity.sats_earned).toBe(0);
    });
});
