'use client';

import { resolveName } from '../utils/nostr-service';
import type { Champion } from '../types';

interface ChampionsTableProps {
    champions: Champion[];
}

export function ChampionsTable({ champions }: ChampionsTableProps) {
    if (!champions.length) {
        return (
            <div className="w-full">
                <h3 className="text-lg font-bold mb-3">Hall of Fame</h3>
                <p className="text-white/50 italic">No hay ganadores aún</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h3 className="text-lg font-bold mb-3">Hall of Fame</h3>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="text-left py-2 px-3 text-neon-orange text-xs font-bold uppercase border-b border-white/10">Campeón</th>
                        <th className="text-left py-2 px-3 text-neon-orange text-xs font-bold uppercase border-b border-white/10">Ganancia</th>
                    </tr>
                </thead>
                <tbody>
                    {champions.map((champion) => (
                        <tr key={champion.pubkey} className="hover:bg-white/5">
                            <td className="py-2 px-3 text-white/90">{champion.alias || resolveName(champion.pubkey)}</td>
                            <td className="py-2 px-3 text-neon-orange font-bold">
                                {champion.sats_earned.toLocaleString()} sats
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
