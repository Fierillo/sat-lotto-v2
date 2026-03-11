import 'dotenv/config';
import { Client } from '@neondatabase/serverless';

async function migrate() {
    const url = process.env.NEON_URL;
    if (!url) throw new Error('NEON_URL not found');

    const client = new Client(url);
    try {
        await client.connect();
        console.log('🚀 Creating tables...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS lotto_bets (
                id SERIAL PRIMARY KEY,
                pubkey TEXT NOT NULL,
                alias TEXT,
                selected_number INTEGER NOT NULL,
                target_block INTEGER NOT NULL,
                betting_block INTEGER NOT NULL,
                is_paid BOOLEAN DEFAULT FALSE,
                nostr_event_id TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(pubkey, target_block)
            );
        `);
        console.log('✅ lotto_bets table created');

        await client.query(`
            CREATE TABLE IF NOT EXISTS lotto_identities (
                id SERIAL PRIMARY KEY,
                pubkey TEXT NOT NULL UNIQUE,
                alias TEXT,
                nip05 TEXT,
                lud16 TEXT,
                last_updated TIMESTAMP WITH TIME ZONE,
                last_celebrated_block INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ lotto_identities table created');

        await client.query(`
            CREATE TABLE IF NOT EXISTS lotto_payouts (
                id SERIAL PRIMARY KEY,
                pubkey TEXT NOT NULL,
                block_height INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                tx_hash TEXT,
                error_log TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(pubkey, block_height, type)
            );
        `);
        console.log('✅ lotto_payouts table created');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_bets_target ON lotto_bets(target_block);
            CREATE INDEX IF NOT EXISTS idx_bets_pubkey ON lotto_bets(pubkey);
            CREATE INDEX IF NOT EXISTS idx_bets_event ON lotto_bets(nostr_event_id);
            CREATE INDEX IF NOT EXISTS idx_payouts_pubkey ON lotto_payouts(pubkey);
        `);
        console.log('✅ Indexes created');

        console.log('🎉 Migration complete!');
    } catch (err: any) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
