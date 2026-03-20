'use client';

import type { Champion } from '../types';

interface ChampionsTableProps {
    champions: Champion[];
}

export function ChampionsTable({ champions }: ChampionsTableProps) {
    if (!champions.length) {
        return (
            <>
                <h3>Hall of Fame</h3>
                <p className="empty-bets">No hay ganadores aún</p>
            </>
        );
    }

    return (
        <>
            <h3>Hall of Fame</h3>
            <table>
                <thead>
                    <tr>
                        <th>Campeón</th>
                        <th>Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    {champions.map((champion) => (
                        <tr key={champion.pubkey} className="table-row-hover">
                            <td>{champion.alias || `${champion.pubkey.slice(0, 8)}...`}</td>
                            <td className="table-sats">
                                {champion.sats_earned.toLocaleString()} sats
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
