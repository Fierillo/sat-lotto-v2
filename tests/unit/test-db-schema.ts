import 'dotenv/config';
import { Client } from '@neondatabase/serverless';

async function testSchema() {
    const url = process.env.NEON_URL;
    if (!url) {
        console.error('❌ NEON_URL not found');
        process.exit(1);
    }

    const client = new Client(url);
    try {
        await client.connect();
        console.log('🧪 Testing database schema consistency...\n');

        const checks = [
            { table: 'lotto_bets', column: 'payment_request' },
            { table: 'lotto_bets', column: 'payment_hash' },
            { table: 'lotto_bets', column: 'nostr_event_id' },
            { table: 'lotto_identities', column: 'sats_earned' },
            { table: 'lotto_identities', column: 'lud16' },
            { table: 'lotto_payouts', column: 'type' },
        ];

        for (const check of checks) {
            const res = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = $2
                );
            `, [check.table, check.column]);
            const exists = res.rows[0].exists;
            console.log(`${exists ? '✅' : '❌'} ${check.table}.${check.column} ${exists ? 'exists' : 'is MISSING'}`);
        }

        const resResolved = await client.query(`
            SELECT count(*) FROM lotto_payouts WHERE type = 'cycle_resolved'
        `);
        console.log(`\nℹ️  Cycles resolved recorded: ${resResolved.rows[0].count}`);

    } catch (err: any) {
        console.error('❌ Schema check failed:', err.message);
    } finally {
        await client.end();
    }
}

testSchema();
