'use client';

import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';

interface ChampionParams {
    satsWon?: number;
    pubkey?: string;
    blockHeight: number;
    winningNumber?: number;
    onClose?: () => void;
}

interface DebugButtonsProps {
    triggerChampion: (params: ChampionParams) => void;
    triggerPotentialWinner: (params: ChampionParams) => void;
}

const btnStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.85)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    zIndex: 9999,
};

const DEBUG_CHAMPIONS = [
    { pubkey: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234', nip05: 'Satoshi@nostr.com', sats_earned: 8500 },
    { pubkey: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567', nip05: 'Lightning@nostr.com', sats_earned: 12300 },
    { pubkey: 'c3d4e5f67890123456789012345678901234567890123456789012345678', nip05: 'NostrFan@nostr.com', sats_earned: 4200 },
    { pubkey: 'd4e5f6789012345678901234567890123456789012345678901234567890', nip05: 'BitcoinMaxi@nostr.com', sats_earned: 2100 }
];

export function DebugButtons({ triggerChampion, triggerPotentialWinner }: DebugButtonsProps) {
    const { state: gameState, refreshGame } = useGame();
    const { state: authState } = useAuth();
    const [isLoadingChampions, setIsLoadingChampions] = useState(false);
    const [championsActive, setChampionsActive] = useState(false);

    const handleFlash = () => {
        document.body.classList.add('flash-green');
        setTimeout(() => {
            document.body.classList.remove('flash-green');
        }, 3000);
    };

    const handleFrozen = () => {
        document.body.classList.toggle('phase-frozen');
    };

    const handleResolving = () => {
        document.body.classList.toggle('phase-resolving');
    };

    const handleVictory = () => {
        triggerChampion({
            satsWon: 0,
            pubkey: gameState.lastResult?.winners?.[0]?.pubkey || authState.pubkey || undefined,
            blockHeight: gameState.targetBlock
        });
    };

    const handleChampions = async () => {
        setIsLoadingChampions(true);
        try {
            const action = championsActive ? 'reset' : 'set';
            const response = await fetch('/api/debug/champions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    champions: DEBUG_CHAMPIONS,
                    action,
                }),
            });

            if (response.ok) {
                setChampionsActive(!championsActive);
                await refreshGame();
            } else {
                const data = await response.json();
                console.error('[DEBUG CHAMPIONS]', data.error);
            }
        } catch (e) {
            console.error('[DEBUG CHAMPIONS]', e);
        } finally {
            setIsLoadingChampions(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 9999,
            }}
        >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleFlash}
                    style={{ ...btnStyle, border: '1px solid #00ff9d', color: '#00ff9d' }}
                >
                    ⚡ FLASH
                </button>
                <button
                    onClick={handleFrozen}
                    style={{ ...btnStyle, border: '1px solid #00f2ff', color: '#00f2ff' }}
                >
                    ❄️ FROZEN
                </button>
                <button
                    onClick={handleResolving}
                    style={{ ...btnStyle, border: '1px solid #f7931a', color: '#f7931a' }}
                >
                    🔥 RESOLVING
                </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleVictory}
                    style={{ ...btnStyle, border: '1px solid #f7931a', color: '#f7931a' }}
                >
                    🏆 VICTORY
                </button>
                <button
                    onClick={() => triggerPotentialWinner({ pubkey: authState.pubkey || undefined, blockHeight: gameState.targetBlock })}
                    style={{ ...btnStyle, border: '1px solid #00ff9d', color: '#00ff9d' }}
                >
                    👑 POTENTIAL
                </button>
                <button
                    onClick={handleChampions}
                    disabled={isLoadingChampions}
                    style={{
                        ...btnStyle,
                        border: `1px solid ${championsActive ? '#00ff9d' : '#ff00ff'}`,
                        color: championsActive ? '#00ff9d' : '#ff00ff',
                        opacity: isLoadingChampions ? 0.5 : 1,
                    }}
                >
                    {isLoadingChampions ? '⏳...' : championsActive ? '🏅 CHAMPIONS ON' : '🏅 CHAMPIONS OFF'}
                </button>
            </div>
        </div>
    );
}