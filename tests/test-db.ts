import 'dotenv/config';
import { Client } from '@neondatabase/serverless';

async function testConnection() {
    const url = process.env.NEON_URL;
    console.log('Testing Neon connection...');
    console.log('URL status:', url ? 'Defined' : 'Missing');
    
    if (!url) {
        console.error('Error: NEON_URL not found in environment');
        return;
    }

    const client = new Client(url);
    try {
        await client.connect();
        console.log('Successfully connected to Neon');
        
        const res = await client.query('SELECT 1 as connection_test');
        console.log('Query result:', res.rows);
    } catch (err: any) {
        console.error('Connection failed:', err.message);
    } finally {
        await client.end();
    }
}

testConnection();
