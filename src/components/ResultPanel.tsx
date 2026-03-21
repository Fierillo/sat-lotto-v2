'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { TransparencyModal } from './modals/TransparencyModal';
import { PotentialWinnerModal } from './modals/PotentialWinnerModal';
import { useVictoryCelebration } from '../hooks/useVictoryCelebration';
import type { Bet } from '../types';

interface ResultPanelProps {
    lastResult: {
        resolved: boolean;
        blockHash?: string;
        winningNumber?: number;
        winners?: Bet[];
        targetBlock: number;
        blocksUntilCelebration?: number;
        hasConfirmed?: boolean;
    } | null;
    targetBlock: number;
}

export function ResultPanel({ lastResult, targetBlock }: ResultPanelProps) {
    const { state: authState } = useAuth();
    const { setVictoryBlock } = useGame();
    const [showPotentialModal, setShowPotentialModal] = useState(false);
    const [showTransparency, setShowTransparency] = useState(false);
    const { triggerCelebration, ChampionModal } = useVictoryCelebration();

    useEffect(() => {
        if (!authState.pubkey || !lastResult?.winners || !lastResult.resolved) return;

        const isWinner = lastResult.winners.some(
            (w: Bet) => w.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
        );

        if (!isWinner) return;

        const blockHeight = lastResult.targetBlock;
        const effectiveLastCelebrated = Math.max(authState.lastCelebratedBlock || 0, 0);

        if (blockHeight > effectiveLastCelebrated) {
            if (lastResult.hasConfirmed) {
                setVictoryBlock(blockHeight);
                triggerCelebration({
                    satsWon: 0,
                    lud16: null,
                    pubkey: authState.pubkey || undefined,
                    blockHeight
                });
            } else {
                setShowPotentialModal(true);
            }
        }
    }, [lastResult, authState.pubkey, authState.lastCelebratedBlock, setVictoryBlock, triggerCelebration]);

    if (!lastResult?.resolved) return null;

    const winnersText = lastResult.winners?.length
        ? lastResult.winners.map((winner: Bet) => winner.alias || `${winner.pubkey.slice(0, 8)}...`).join(', ')
        : 'Nadie';

    const handlePotentialClose = () => {
        setShowPotentialModal(false);
        setVictoryBlock(lastResult.targetBlock);
    };

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

            <PotentialWinnerModal
                isOpen={showPotentialModal}
                onClose={handlePotentialClose}
                blockHeight={lastResult.targetBlock}
                winningNumber={lastResult.winningNumber}
                pubkey={authState.pubkey || undefined}
            />

            {ChampionModal}

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
