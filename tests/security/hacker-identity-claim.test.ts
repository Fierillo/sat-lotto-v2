import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('hacker-identity-endpoint', () => {
    const victimPubkey = 'a'.repeat(64);
    const attackerSk = generateSecretKey();
    const attackerPubkey = getPublicKey(attackerSk);

    function createKind0Event(content: string, pubkey: string, sk: Uint8Array, ageSeconds = 0) {
        const event = {
            kind: 0,
            created_at: Math.floor(Date.now() / 1000) - ageSeconds,
            tags: [],
            content,
            pubkey
        };
        return finalizeEvent(event, sk);
    }

    function createKind1Event(content: string, pubkey: string, sk: Uint8Array, ageSeconds = 0) {
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000) - ageSeconds,
            tags: [],
            content,
            pubkey
        };
        return finalizeEvent(event, sk);
    }

    describe('POST /api/identity/[pubkey] - LN Address Hijacking Protection', () => {
        it('should reject request without signature', async () => {
            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lud16: 'attacker@evil.com' })
            });

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toMatch(/signature/i);
        });

        it('should reject request with invalid signature', async () => {
            const invalidEvent = {
                kind: 0,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify({ lud16: 'attacker@evil.com' }),
                pubkey: victimPubkey,
                sig: 'invalid_signature_1234567890'
            };

            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: invalidEvent })
            });

            expect(res.status).toBe(400);
        });

        it('should reject event signed by different pubkey (identity hijacking)', async () => {
            const event = createKind0Event(
                JSON.stringify({ lud16: 'attacker@evil.com' }),
                attackerPubkey,
                attackerSk
            );

            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/pubkey/i);
        });

        it('should reject expired signature (replay attack with old event)', async () => {
            const expiredSk = generateSecretKey();
            const expiredPubkey = getPublicKey(expiredSk);

            const event = createKind0Event(
                JSON.stringify({ lud16: 'attacker@evil.com' }),
                expiredPubkey,
                expiredSk,
                1000
            );

            const res = await fetch(`${API_URL}/api/identity/${expiredPubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/expired/i);
        });
    });

    describe('POST /api/identity/[pubkey]/claim - Prize Claim Protection', () => {
        it('should reject claim without signature', async () => {
            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toMatch(/signature/i);
        });

        it('should reject claim with invalid signature', async () => {
            const invalidEvent = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', victimPubkey]],
                content: `Claim prize for ${victimPubkey}`,
                pubkey: victimPubkey,
                sig: 'invalid_signature_1234567890'
            };

            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent: invalidEvent })
            });

            expect(res.status).toBe(400);
        });

        it('should reject claim signed by different pubkey (prize theft)', async () => {
            const event = createKind1Event(
                `Claim prize for ${victimPubkey}`,
                attackerPubkey,
                attackerSk
            );

            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent: event })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/pubkey/i);
        });

        it('should reject expired claim signature (replay attack with old claim)', async () => {
            const expiredSk = generateSecretKey();
            const expiredPubkey = getPublicKey(expiredSk);

            const event = createKind1Event(
                `Claim prize for ${expiredPubkey}`,
                expiredPubkey,
                expiredSk,
                400
            );

            const res = await fetch(`${API_URL}/api/identity/${expiredPubkey}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signedEvent: event })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/expired/i);
        });
    });

    describe('GET /api/identity/[pubkey] - Information Disclosure', () => {
        it('should NOT expose pendingAmount to unauthenticated requests', async () => {
            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`);
            const data = await res.json();

            expect(data).not.toHaveProperty('pendingAmount');
        });

        it('should still return lud16, nip05, sats_earned etc', async () => {
            const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`);
            const data = await res.json();

            expect(data).toHaveProperty('lud16');
            expect(data).toHaveProperty('nip05');
            expect(data).toHaveProperty('sats_earned');
            expect(data).toHaveProperty('sats_pending');
            expect(data).toHaveProperty('winner_block');
            expect(data).toHaveProperty('can_claim');
        });
    });
});
