import 'dotenv/config';
import { queryNeon } from '../src/lib/db';

async function initRateLimitsTable() {
    console.log('[Init] Creating rate_limits table...');
    
    try {
        await queryNeon(`
            CREATE TABLE IF NOT EXISTS rate_limits (
                key TEXT PRIMARY KEY,
                count INTEGER DEFAULT 1,
                window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('[Init] Table rate_limits created or already exists');
        
        await queryNeon(`
            CREATE INDEX IF NOT EXISTS idx_rate_limits_window 
            ON rate_limits(window_start)
        `);
        console.log('[Init] Index created');
        
        console.log('✅ Done!');
    } catch (err: any) {
        console.error('[Init] Error:', err.message);
    }
}

initRateLimitsTable();
