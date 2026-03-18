'use client';

import { useMemo } from 'react';
import { resolveName } from '../utils/nostr-service';
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
            <div className="w-full">
                <h3 className="text-lg font-bold mb-3">Apuestas Activas</h3>
                <p className="text-white/50 italic">Sin apuestas en este ciclo</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h3 className="text-lg font-bold mb-3">Apuestas Activas</h3>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="text-left py-2 px-3 text-neon-orange text-xs font-bold uppercase border-b border-white/10">Jugador</th>
                        <th className="text-left py-2 px-3 text-neon-orange text-xs font-bold uppercase border-b border-white/10">Número</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedBets.map((bet, index) => (
                        <tr key={`${bet.pubkey}-${bet.selected_number}-${index}`} className="hover:bg-white/5">
                            <td className="py-2 px-3 text-white/90">{bet.alias || resolveName(bet.pubkey)}</td>
                            <td className="py-2 px-3 text-white/90">{bet.selected_number}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
