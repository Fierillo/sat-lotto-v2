'use client';

import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { PotentialWinnerModal } from './modals/PotentialWinnerModal';
import { useVictoryCelebration } from '../hooks/useVictoryCelebration';

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
    { pubkey: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234', alias: 'Satoshi', sats_earned: 8500 },
    { pubkey: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567', alias: 'Lightning', sats_earned: 12300 },
    { pubkey: 'c3d4e5f67890123456789012345678901234567890123456789012345678', alias: 'NostrFan', sats_earned: 4200 },
    { pubkey: 'd4e5f6789012345678901234567890123456789012345678901234567890', alias: 'BitcoinMaxi', sats_earned: 2100 }
];

export function DebugButtons() {
    const { state: gameState, triggerDebugVictory, triggerDebugPotential, clearDebugPotential, refreshGame } = useGame();
    const [isLoadingChampions, setIsLoadingChampions] = useState(false);
    const [championsActive, setChampionsActive] = useState(false);
    const { triggerCelebration, ChampionModal } = useVictoryCelebration();

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
        triggerCelebration({
            satsWon: 0,
            lud16: null,
            pubkey: '',
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
        <>
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
                        onClick={triggerDebugPotential}
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

            <PotentialWinnerModal
                isOpen={gameState.debugShowPotential}
                onClose={clearDebugPotential}
                blockHeight={gameState.targetBlock}
            />

            {ChampionModal}
        </>
    );
}
