import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Identity API Integration Tests', () => {
    const testPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    it('should get identity for a pubkey', async () => {
        const res = await fetch(`${API_URL}/api/identity/${testPubkey}`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toHaveProperty('nip05');
        expect(data).toHaveProperty('sats_earned');
        expect(data).toHaveProperty('lud16');
        expect(typeof data.nip05).toBe('string');
        expect(typeof data.sats_earned).toBe('number');
    });

    it('should update identity with lud16', async () => {
        const testLud16 = `integration_${Date.now()}@test.com`;

        const res = await fetch(`${API_URL}/api/identity/${testPubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lud16: testLud16,
                nip05: 'testuser@test.com'
            })
        });

        expect([200, 201]).toContain(res.status);
    });

    it('should persist identity after update', async () => {
        const testLud16 = `integration_${Date.now()}@test.com`;

        await fetch(`${API_URL}/api/identity/${testPubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lud16: testLud16
            })
        });

        const getRes = await fetch(`${API_URL}/api/identity/${testPubkey}`);
        const data = await getRes.json();

        expect(data.lud16).toBe(testLud16);
    });

    it('should return valid identity structure', async () => {
        const res = await fetch(`${API_URL}/api/identity/${testPubkey}`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(typeof data.sats_earned).toBe('number');
        expect(data.sats_earned).toBeGreaterThanOrEqual(0);
    });
});
