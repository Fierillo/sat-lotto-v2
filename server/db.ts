import { Client } from '@neondatabase/serverless';

export const queryNeon = async (queryText: string, params: any[] = []) => {
    const url = process.env.NEON_URL;
    if (!url || url.includes('user:password')) return [];
    
    const client = new Client(url);
    try {
        await client.connect();
        const res = await client.query(queryText, params);
        return res.rows;
    } catch (err: any) {
        console.error('[Neon DB Error]', err.message);
        throw err;
    } finally {
        await client.end();
    }
};
