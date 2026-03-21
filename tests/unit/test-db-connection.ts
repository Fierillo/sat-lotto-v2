import 'dotenv/config';
import { Client } from '@neondatabase/serverless';

async function testConnection() {
    const url = process.env.NEON_URL;
    if (!url) {
        console.error('❌ NEON_URL not found in environment');
        process.exit(1);
    }

    const client = new Client(url);
    try {
        await client.connect();
        console.log('✅ Connection to Neon successful!');

        const tables = ['lotto_bets', 'lotto_identities', 'lotto_payouts'];
        console.log('\n📊 Checking tables:');
        
        for (const table of tables) {
            const res = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                );
            `, [table]);
            const exists = res.rows[0].exists;
            console.log(`${exists ? '✅' : '❌'} Table ${table} ${exists ? 'exists' : 'is missing'}`);
        }

        console.log('\n💡 To initialize the database, use the schema.sql file in the project root.');
    } catch (err: any) {
        console.error('❌ Database error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testConnection();
