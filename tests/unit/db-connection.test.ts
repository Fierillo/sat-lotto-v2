import 'dotenv/config';
import { Client } from '@neondatabase/serverless';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Database Connection', () => {
    const url = process.env.NEON_URL;
    
    beforeAll(() => {
        if (!url) {
            throw new Error('NEON_URL not found in environment');
        }
    });

    it('should connect to Neon database', async () => {
        const client = new Client(url!);
        await expect(client.connect()).resolves.not.toThrow();
        await client.end();
    });

    it('should have lotto_bets table', async () => {
        const client = new Client(url!);
        await client.connect();
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'lotto_bets'
            );
        `);
        expect(res.rows[0].exists).toBe(true);
        await client.end();
    });

    it('should have lotto_identities table', async () => {
        const client = new Client(url!);
        await client.connect();
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'lotto_identities'
            );
        `);
        expect(res.rows[0].exists).toBe(true);
        await client.end();
    });

    it('should have lotto_payouts table', async () => {
        const client = new Client(url!);
        await client.connect();
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'lotto_payouts'
            );
        `);
        expect(res.rows[0].exists).toBe(true);
        await client.end();
    });
});
