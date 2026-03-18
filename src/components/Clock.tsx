'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { usePayment } from '../hooks/usePayment';

const BLOCKS = 21;
const MARKER_RADIUS = 230;

interface ClockProps {
    onShowLogin?: () => void;
    onShowFrozenHelp?: () => void;
}

export function Clock({ onShowLogin, onShowFrozenHelp }: ClockProps) {
    const { state: authState } = useAuth();
    const { state: gameState, selectNumber, isFrozen, isResolving } = useGame();
    const { makePayment } = usePayment();

    // Calculate block markers
    const markers = useMemo(() => {
        return Array.from({ length: BLOCKS }, (_, i) => {
            const val = i === 0 ? gameState.targetBlock : gameState.targetBlock - BLOCKS + i;
            const deg = (i * 360 / BLOCKS - 90) * Math.PI / 180;
            const x = Math.cos(deg) * MARKER_RADIUS;
            const y = Math.sin(deg) * MARKER_RADIUS;
            const isTarget = i === 0;
            const isNearEnd = i >= 19;
            const isCurrent = val === gameState.currentBlock;

            return { value: val, x, y, isTarget, isNearEnd, isCurrent };
        });
    }, [gameState.targetBlock, gameState.currentBlock]);

    // Calculate number segments
    const segments = useMemo(() => {
        return Array.from({ length: BLOCKS }, (_, i) => {
            const deg = i * 360 / BLOCKS;
            const num = i === 0 ? 21 : i;
            return { num, deg };
        });
    }, []);

    const handleNumberClick = useCallback((num: number) => {
        if (!authState.pubkey) {
            onShowLogin?.();
            return;
        }
        if (document.body.classList.contains('processing')) return;
        if (gameState.selectedNumber === num) return;
        selectNumber(num);
    }, [authState.pubkey, gameState.selectedNumber, selectNumber, onShowLogin]);

    const handleCenterClick = useCallback(async () => {
        if (!authState.pubkey) {
            onShowLogin?.();
            return;
        }
        if (isFrozen || isResolving) return;
        if (gameState.selectedNumber === null) return;
        await makePayment();
    }, [authState.pubkey, isFrozen, isResolving, gameState.selectedNumber, makePayment, onShowLogin]);

    // Button state
    const showButton = !authState.pubkey || isFrozen || isResolving || gameState.selectedNumber !== null;
    const buttonContent = !authState.pubkey
        ? 'JUGAR'
        : isResolving
            ? <span>FIN DE<br />RONDA</span>
            : isFrozen
                ? <span>NO PODÉS<br />APOSTAR</span>
                : gameState.selectedNumber !== null
                    ? 'APOSTAR'
                    : null;
    const isButtonFrozen = !authState.pubkey ? false : (isFrozen || isResolving);

    return (
        <div className="relative w-[520px] h-[520px]">
            {/* Outer ring with block markers */}
            <div className="absolute inset-0 rounded-full border-2 border-white/10">
                {markers.map((marker, i) => (
                    <div
                        key={i}
                        className={`
                            absolute w-10 h-10 rounded-full
                            flex items-center justify-center text-xs
                            transition-all duration-300
                            ${marker.isTarget
                                ? 'bg-neon-orange text-white font-bold shadow-[0_0_10px_#f7931a]'
                                : marker.isCurrent
                                    ? 'bg-neon-green text-black font-bold shadow-[0_0_10px_#00ff9d]'
                                    : marker.isNearEnd
                                        ? 'text-neon-blue border border-neon-blue bg-transparent'
                                        : 'text-white/60 bg-black/30'
                            }
                        `}
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translate(${marker.x}px, ${marker.y}px)`,
                        }}
                    >
                        {marker.value}
                    </div>
                ))}
            </div>

            {/* Inner circle with number segments */}
            <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 border-2 border-white/20">
                {segments.map(({ num, deg }) => (
                    <div
                        key={num}
                        className={`
                            absolute top-1/2 left-1/2 w-16 h-10 -translate-x-1/2
                            cursor-pointer flex items-center justify-center
                            rounded-lg transition-all duration-200
                            ${gameState.selectedNumber === num
                                ? 'bg-neon-orange hover:bg-[#e8820c]'
                                : 'hover:bg-white/10'
                            }
                        `}
                        style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
                        onClick={() => handleNumberClick(num)}
                    >
                        <div
                            className="text-base font-bold text-white select-none"
                            style={{ transform: `rotate(${-deg}deg)` }}
                        >
                            {num}
                        </div>
                    </div>
                ))}
            </div>

            {/* Frozen help button */}
            <div
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer font-bold text-white/60 hover:bg-white/20 transition-colors z-10"
                onClick={(e) => {
                    e.stopPropagation();
                    onShowFrozenHelp?.();
                }}
            >
                ?
            </div>

            {/* Center button */}
            {showButton && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5]">
                    <button
                        className={`
                            w-[120px] h-[120px] rounded-full border-0
                            text-white text-lg font-bold
                            flex items-center justify-center text-center
                            transition-all duration-300 leading-tight
                            ${isButtonFrozen
                                ? 'bg-white/20 cursor-not-allowed'
                                : 'bg-neon-orange hover:scale-105 hover:shadow-[0_0_20px_#f7931a]'
                            }
                        `}
                        onClick={isButtonFrozen ? undefined : handleCenterClick}
                        disabled={isButtonFrozen}
                    >
                        {buttonContent}
                    </button>
                </div>
            )}
        </div>
    );
}
