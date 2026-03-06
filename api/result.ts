import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

async function getBlockHash(blockHeight: number): Promise<string | null> {
    try {
        const resp = await fetch(`https://mempool.space/api/block-height/${blockHeight}`);
        if (!resp.ok) return null;
        return resp.text();
    } catch {
        return null;
    }
}

function hashToWinningNumber(hash: string): number {
    return (parseInt(hash.slice(-4), 16) % 21) + 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const block = parseInt(req.query.block as string, 10);
    if (!block) return res.status(400).json({ error: 'Falta el parámetro block' });

    const hash = await getBlockHash(block);
    if (!hash) return res.json({ resolved: false, message: 'Bloque aún no minado' });

    const winningNumber = hashToWinningNumber(hash);

    try {
        const sql = neon(process.env.NEON_URL!);
        const winners = await sql`
            SELECT pubkey, selected_number
            FROM lotto_bets
            WHERE target_block = ${block} AND selected_number = ${winningNumber}
        `;
        return res.json({
            resolved: true,
            blockHash: hash,
            winningNumber,
            winners
        });
    } catch (e: any) {
        return res.json({ resolved: true, blockHash: hash, winningNumber, winners: [], error: e.message });
    }
}
