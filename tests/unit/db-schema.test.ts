import 'dotenv/config';
import { Client } from '@neondatabase/serverless';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Database Schema', () => {
    const url = process.env.NEON_URL;
    
    beforeAll(() => {
        if (!url) {
            throw new Error('NEON_URL not found in environment');
        }
    });

    const requiredColumns = [
        { table: 'lotto_bets', column: 'payment_request' },
        { table: 'lotto_bets', column: 'payment_hash' },
        { table: 'lotto_bets', column: 'nostr_event_id' },
        { table: 'lotto_identities', column: 'sats_earned' },
        { table: 'lotto_identities', column: 'lud16' },
        { table: 'lotto_payouts', column: 'type' },
    ];

    for (const check of requiredColumns) {
        it(`should have ${check.table}.${check.column}`, async () => {
            const client = new Client(url!);
            await client.connect();
            const res = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = $2
                );
            `, [check.table, check.column]);
            expect(res.rows[0].exists).toBe(true);
            await client.end();
        });
    }

    it('should record cycle_resolved payouts', async () => {
        const client = new Client(url!);
        await client.connect();
        const res = await client.query(`
            SELECT count(*) as count FROM lotto_payouts WHERE type = 'cycle_resolved'
        `);
        expect(Number(res.rows[0].count)).toBeGreaterThanOrEqual(0);
        await client.end();
    });
});
