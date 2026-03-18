'use client';

import { useState, useEffect } from 'react';
import { resolveName } from '../utils/nostr-service';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import type { SorteoResult, Bet } from '../types';

interface ResultPanelProps {
    lastResult: SorteoResult | null;
    targetBlock: number;
}

export function ResultPanel({ lastResult, targetBlock }: ResultPanelProps) {
    const { state: authState } = useAuth();
    const { setVictoryBlock } = useGame();
    const [showVictory, setShowVictory] = useState(false);
    const [showTransparency, setShowTransparency] = useState(false);

    useEffect(() => {
        if (!authState.pubkey || !lastResult?.winners || !lastResult.resolved) return;

        const isWinner = lastResult.winners.some(
            (w: Bet) => w.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
        );

        if (!isWinner) return;

        const blockHeight = Math.floor(lastResult.targetBlock);
        const effectiveLastCelebrated = Math.max(authState.lastCelebratedBlock || 0, 0);

        if (blockHeight > effectiveLastCelebrated) {
            setShowVictory(true);
            setVictoryBlock(blockHeight);
            setTimeout(() => setShowVictory(false), 4500);
        }
    }, [lastResult, authState.pubkey, authState.lastCelebratedBlock, setVictoryBlock]);

    if (!lastResult?.resolved) return null;

    const winnersText = lastResult.winners?.length
        ? lastResult.winners.map((winner: Bet) => winner.alias || resolveName(winner.pubkey)).join(', ')
        : 'Nadie';

    return (
        <>
            <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                <h3 className="text-lg font-bold">
                    Último Sorteo: <strong className="text-neon-orange">{targetBlock - 21}</strong>
                </h3>
                <p className="mt-2">
                    Número ganador:{' '}
                    <strong className="text-neon-orange">{lastResult.winningNumber}</strong>{' '}
                    <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-xs cursor-pointer hover:bg-white/20 transition-colors ml-1"
                        onClick={() => setShowTransparency(true)}
                    >
                        ?
                    </span>
                </p>
                <p className="mt-1">
                    Ganadores: <strong>{winnersText}</strong>
                </p>
            </div>

            {/* Victory overlay */}
            {showVictory && (
                <>
                    <div className="fixed inset-0 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent animate-fade-in-out pointer-events-none z-[10000]" />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-7xl font-black z-[10001] animate-winner-pop text-shadow-glow tracking-[20px] uppercase pointer-events-none font-mono whitespace-nowrap">
                        ¡CAMPEÓN!
                    </div>
                </>
            )}

            {/* Transparency modal */}
            {showTransparency && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]" onClick={() => setShowTransparency(false)}>
                    <div className="bg-[#1a1a2e] rounded-2xl p-8 max-w-[450px] w-[90%] border border-white/10 text-left" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-5 text-center">Transparencia</h2>
                        <p className="text-white/80 mb-5 text-sm leading-relaxed">
                            El número ganador <strong>{lastResult.winningNumber}</strong> se
                            obtiene a partir del hash del último bloque en que se sorteo (
                            <b>{Math.floor(lastResult.targetBlock)}</b>):
                        </p>
                        <div className="bg-black/20 p-3 rounded-lg mb-5 border border-white/5 font-mono text-xs text-white/50 break-all">
                            {lastResult.blockHash}
                        </div>
                        <div className="mb-4">
                            <label className="text-neon-orange text-[0.72rem] uppercase block mb-2">
                                Verificalo vos mismo:
                            </label>
                            <code
                                className="block p-3 bg-black/40 rounded-lg text-sm text-white cursor-pointer hover:bg-black/60 transition-colors"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(`BigInt('0x${lastResult.blockHash}') % 21n + 1n`);
                                }}
                            >
                                BigInt('0x{lastResult.blockHash}') % 21n + 1n
                            </code>
                        </div>
                        <p className="text-white/50 text-xs text-center mb-6 leading-tight">
                            Copiá y pegá la fórmula en la consola (F12) o en tu terminal para verificar el resultado exacto.
                        </p>
                        <button
                            className="w-full py-3 bg-neon-orange text-white font-bold rounded-lg hover:bg-[#e8820c] transition-colors"
                            onClick={() => setShowTransparency(false)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
