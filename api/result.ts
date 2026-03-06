import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryNeon } from './neon.js';

async function getBlockHash(blockHeight: number): Promise<string | null> {
    try {
        console.log(`[getBlockHash] Fetching block ${blockHeight}`);
        const resp = await fetch(`https://mempool.space/api/block-height/${blockHeight}`);
        console.log(`[getBlockHash] Status: ${resp.status}`);
        if (!resp.ok) return null;
        const text = await resp.text();
        console.log(`[getBlockHash] Result: ${text}`);
        return text;
    } catch (err: any) {
        console.error(`[getBlockHash] Error: ${err.message}`);
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
        const query = `
            SELECT pubkey, selected_number
            FROM lotto_bets
            WHERE target_block = $1 AND selected_number = $2
        `;
        let winners = [];
        if (process.env.NEON_URL?.includes('user:password')) {
            // Fake return if .env wasn't updated
            winners = [];
        } else {
            winners = await queryNeon(query, [block, winningNumber]);
        }

        return res.json({
            resolved: true,
            blockHash: hash,
            winningNumber,
            winners
        });
    } catch (e: any) {
        if (e.message.includes('42P01')) {
            return res.json({ resolved: true, blockHash: hash, winningNumber, winners: [] });
        }
        return res.json({ resolved: true, blockHash: hash, winningNumber, winners: [], error: e.message });
    }
}
