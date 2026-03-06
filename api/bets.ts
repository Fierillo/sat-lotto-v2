import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const block = parseInt(req.query.block as string, 10);
    if (!block) return res.status(400).json({ error: 'Falta el parámetro block' });

    try {
        const sql = neon(process.env.NEON_URL!);
        const bets = await sql`
            SELECT pubkey, selected_number, created_at
            FROM lotto_bets
            WHERE target_block = ${block}
            ORDER BY created_at DESC
        `;
        return res.json(bets);
    } catch (e: any) {
        return res.status(500).json({ error: `Error consultando apuestas: ${e.message}` });
    }
}
