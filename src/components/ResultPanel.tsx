'use client';

import { useState } from 'react';
import { TransparencyModal } from './modals/TransparencyModal';
import type { Bet } from '../types';

interface ResultPanelProps {
    lastResult: {
        resolved: boolean;
        blockHash?: string;
        winningNumber?: number;
        winners?: Bet[];
        targetBlock: number;
    } | null;
    targetBlock: number;
}

export function ResultPanel({ lastResult, targetBlock }: ResultPanelProps) {
    const [showTransparency, setShowTransparency] = useState(false);

    if (!lastResult?.resolved) return null;

    const winnersText = lastResult.winners?.length
        ? lastResult.winners.map((winner: Bet) => winner.nip05 || `${winner.pubkey.slice(0, 8)}...`).join(', ')
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