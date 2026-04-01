import { Client } from '@neondatabase/serverless';

export const queryNeon = async (queryText: string, params: any[] = []) => {
    const url = process.env.NEON_URL;
    if (!url || url.includes('user:password')) return [];
    
    const client = new Client(url) as any;
    try {
        await client.connect();
        const res = await client.query(queryText, params);
        return res.rows;
    } catch (err: any) {
        console.error('[Neon DB Error]', err.message);
        throw err;
    } finally {
        try {
            await client.end();
        } catch (e: any) {
            console.error('[Neon DB Error] closing connection:', e.message);
        }
    }
};

export async function dbGet<T>(table: string, where: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    const rows = await queryNeon(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values);
    return rows.length > 0 ? rows[0] as T : null;
}

export async function dbGetAll<T>(table: string, where?: Record<string, any>): Promise<T[]> {
    if (!where) {
        return queryNeon(`SELECT * FROM ${table}`, []) as Promise<T[]>;
    }
    const keys = Object.keys(where);
    const values = Object.values(where);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    return queryNeon(`SELECT * FROM ${table} WHERE ${conditions}`, values) as Promise<T[]>;
}

export async function dbInsert<T>(table: string, data: T): Promise<number> {
    const keys = Object.keys(data as Record<string, any>);
    const values = Object.values(data as Record<string, any>);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    try {
        const result = await queryNeon(
            `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING id`,
            values
        );
        return result[0]?.id ?? 0;
    } catch (err: any) {
        if (err.code === '42703') {
            await queryNeon(
                `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
                values
            );
            return 0;
        }
        throw err;
    }
}

export async function dbUpdate(table: string, where: Record<string, any>, data: Record<string, any>): Promise<void> {
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const whereConditions = whereKeys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    const setClause = dataKeys.map((k, i) => `${k} = $${whereKeys.length + i + 1}`).join(', ');
    await queryNeon(
        `UPDATE ${table} SET ${setClause} WHERE ${whereConditions}`,
        [...whereValues, ...dataValues]
    );
}

export async function dbDelete(table: string, where: Record<string, any>): Promise<void> {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    await queryNeon(`DELETE FROM ${table} WHERE ${conditions}`, values);
}