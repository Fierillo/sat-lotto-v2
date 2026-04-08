import { queryNeon } from './db';
import { blockHashCache } from './cache';

export const calculateResult = async (block: number) => {
    let hash = blockHashCache[block];
    if (!hash) {
        try {
            const resp = await fetch(`https://mempool.space/api/block-height/${block}`);
            if (!resp.ok) return null;
            hash = (await resp.text()).trim();
            blockHashCache[block] = hash;
        } catch { return null; }
    }
    const winningNumber = Number((BigInt('0x' + hash) % BigInt(21)) + BigInt(1));
    return { hash, winningNumber };
};

export async function getWinners(targetBlock: number, winningNumber: number) {
    return queryNeon(`
        SELECT DISTINCT ON (b.pubkey) 
            b.pubkey, i.nip05, i.lud16
        FROM lotto_bets b
        LEFT JOIN lotto_identities i ON b.pubkey = i.pubkey
        WHERE b.target_block = $1 AND b.selected_number = $2 AND b.is_paid = TRUE AND b.betting_block >= ($1 - 21)
        ORDER BY b.pubkey, b.created_at DESC
    `, [targetBlock, winningNumber]);
}

export function buildAnnouncement(targetBlock: number, winners: any[], totalSats: number): string {
    const winnerNames = winners.map((w) => w.nip05 || w.pubkey.slice(0, 8));
    const prizePerWinner = winners.length > 0 ? Math.floor(totalSats / winners.length) : 0;

    return winners.length > 0 
        ? `¡Ronda ${targetBlock} confirmada! 🏆\n\nCampeones: ${winnerNames.join(', ')}\nPremio repartido: ${prizePerWinner} sats c/u.\n\nFelicidades a los ganadores. ¡La suerte está echada!\n\nJugá vos también en: ${process.env.APP_URL || 'https://satlotto.ar'}`
        : `¡Ronda ${targetBlock} confirmada!\n\nEsta vez el azar fue esquivo y no hubo ganadores. 🎲\n\nEl pozo de ${totalSats} sats se acumula para el próximo sorteo. ¡Aprovechá la oportunidad!\n\nParticipá en: ${process.env.APP_URL || 'https://satlotto.ar'}`;
}
