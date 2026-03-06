import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryNeon } from './neon.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const block = parseInt(req.query.block as string, 10);
    if (!block) return res.status(400).json({ error: 'Falta el parámetro block' });

    try {
        const query = `
            SELECT pubkey, selected_number, created_at
            FROM lotto_bets
            WHERE target_block = $1
            ORDER BY created_at DESC
        `;
        let bets = [];
        if (process.env.NEON_URL?.includes('user:password')) {
            bets = [];
        } else {
            bets = await queryNeon(query, [block]);
        }
        return res.json({ bets });
    } catch (e: any) {
        if (e.message.includes('42P01')) return res.json({ bets: [] });
        return res.status(500).json({ error: `Error consultando apuestas: ${e.message}` });
    }
}
