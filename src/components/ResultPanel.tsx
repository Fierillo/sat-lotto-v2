'use client';

import { useState, useEffect } from 'react';
import { resolveName } from '../utils/nostr-service';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { Modal } from './modals/Modal';
import { TransparencyModal } from './modals/TransparencyModal';
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
            <h3>Último Sorteo: <strong className="text-orange">{targetBlock - 21}</strong></h3>
            <p>
                Número ganador:{' '}
                <strong className="text-orange">{lastResult.winningNumber}</strong>{' '}
                <span className="help-icon" onClick={() => setShowTransparency(true)}>?</span>
            </p>
            <p>
                Ganadores: <strong>{winnersText}</strong>
            </p>

            {/* Victory overlay */}
            {showVictory && (
                <>
                    <div className="winner-overlay" />
                    <div className="victory-text-animation">
                        ¡CAMPEÓN!
                    </div>
                </>
            )}

            {/* Transparency modal */}
            <TransparencyModal
                isOpen={showTransparency}
                onClose={() => setShowTransparency(false)}
                winningNumber={lastResult.winningNumber}
                targetBlock={lastResult.targetBlock}
                blockHash={lastResult.blockHash}
            />
        </>
    );
}
