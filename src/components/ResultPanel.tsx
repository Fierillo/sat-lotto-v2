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
    const [copied, setCopied] = useState(false);

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

    const handleCopy = async () => {
        const formula = `BigInt('0x${lastResult.blockHash}') % 21n + 1n`;
        await navigator.clipboard.writeText(formula);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
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
            {showTransparency && (
                <div className="modal-bg" onClick={() => setShowTransparency(false)}>
                    <div className="modal auth-modal" style={{ maxWidth: '450px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ textAlign: 'center' }}>Transparencia</h2>
                        <p style={{ fontSize: '0.9rem', marginBottom: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
                            El número ganador <strong>{lastResult.winningNumber}</strong> se obtiene a partir del hash del último bloque en que se sorteo (<b>{Math.floor(lastResult.targetBlock)}</b>):
                        </p>
                        
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(255,255,212,0.05)' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-dim)' }}>{lastResult.blockHash}</div>
                        </div>

                        <div style={{ marginBottom: '0' }}>
                            <label style={{ fontSize: '0.72rem', color: 'var(--neon-orange)', textTransform: 'uppercase', display: 'block' }}>Verificalo vos mismo:</label>
                            <code className={`verify-command ${copied ? 'copied' : ''}`} style={{ cursor: 'pointer', padding: '12px', display: 'block', background: 'rgba(0,0,0,0.4)', position: 'relative', margin: '5px 0' }} onClick={handleCopy}>
                                BigInt('0x{lastResult.blockHash}') % 21n + 1n
                            </code>
                            <div style={{ color: 'var(--neon-green)', fontSize: '0.65rem', textAlign: 'center', marginTop: '-10px', marginBottom: '0', opacity: copied ? 1 : 0, transition: 'opacity 0.3s', fontWeight: 'bold' }}>¡Copiado! ⚡</div>
                        </div>

                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', marginBottom: '15px', lineHeight: '1.2', textAlign: 'center' }}>
                            Copiá y pegá la fórmula en la consola (F12) o en tu terminal para verificar el resultado exacto.
                        </p>

                        <button className="auth-btn" style={{ width: '100%' }} onClick={() => setShowTransparency(false)}>
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
