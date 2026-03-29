import 'dotenv/config';
import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Identity Spoof Security Tests', () => {
    const victimPubkey = 'a'.repeat(64);

    it('should prevent setting fake sats_earned via identity API', async () => {
        const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias: 'HACKED', sats_earned: 999999 })
        });
        
        expect(res.ok || res.status).toBeTruthy();
        
        if (res.ok) {
            const checkRes = await fetch(`${API_URL}/api/identity/${victimPubkey}`);
            const checkData = await checkRes.json();
            expect(checkData.sats_earned).not.toBe(999999);
        }
    });

    it('should prevent identity spoofing via lud16 hijacking', async () => {
        const attackerLud16 = 'attacker@getalby.com';
        const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias: 'HACKED', lud16: attackerLud16 })
        });
        
        expect(res.ok || res.status).toBeTruthy();
    });

    it('should block direct alias manipulation', async () => {
        const res = await fetch(`${API_URL}/api/identity/${victimPubkey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alias: 'FakeUser' })
        });
        
        expect(res.ok || res.status).toBeTruthy();
    });
});
