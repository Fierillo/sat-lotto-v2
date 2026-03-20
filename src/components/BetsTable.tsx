'use client';

import { useMemo } from 'react';
import type { Bet } from '../types';

interface BetsTableProps {
    bets: Bet[];
}

export function BetsTable({ bets }: BetsTableProps) {
    const sortedBets = useMemo(() => {
        return [...bets].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
        });
    }, [bets]);

    if (!bets.length) {
        return (
            <>
                <h3>Apuestas Activas</h3>
                <p className="empty-bets">Sin apuestas en este ciclo</p>
            </>
        );
    }

    return (
        <>
            <h3>Apuestas Activas</h3>
            <table>
                <thead>
                    <tr>
                        <th>Jugador</th>
                        <th>Número</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedBets.map((bet, index) => (
                        <tr key={`${bet.pubkey}-${bet.selected_number}-${index}`} className="hover:bg-white/5">
                            <td>{bet.alias || `${bet.pubkey.slice(0, 8)}...`}</td>
                            <td>{bet.selected_number}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
