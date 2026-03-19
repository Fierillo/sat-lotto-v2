'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { usePayment } from '../hooks/usePayment';
import { CenterButton } from './CenterButton';
import { FreezeHelpModal } from './modals/FreezeHelpModal';

const BLOCKS = 21;
const MARKER_RADIUS = 230;

interface ClockProps {
    onShowLogin?: () => void;
    onShowFrozenHelp?: () => void;
}

export function Clock({ onShowLogin, onShowFrozenHelp }: ClockProps) {
    const { state: authState } = useAuth();
    const { state: gameState, selectNumber, isFrozen, isResolving } = useGame();
    const { makePayment, paymentStatus, paymentError } = usePayment();
    const [showFreezeHelpModal, setShowFreezeHelpModal] = useState(false);

    // Update body classes based on game phase and auth
    useEffect(() => {
        const body = document.body;
        body.classList.toggle('logged-out', !authState.pubkey);
        body.classList.toggle('phase-frozen', isFrozen && !isResolving);
        body.classList.toggle('phase-resolving', isResolving);
        // processing class is added elsewhere when payment is in progress
        return () => {
            body.classList.remove('logged-out', 'phase-frozen', 'phase-resolving');
        };
    }, [authState.pubkey, isFrozen, isResolving]);

    // Calculate block markers
    const markers = useMemo(() => {
        return Array.from({ length: BLOCKS }, (_, i) => {
            const val = i === 0 ? gameState.targetBlock : gameState.targetBlock - BLOCKS + i;
            const deg = (i * 360 / BLOCKS - 90) * Math.PI / 180;
            const x = Math.cos(deg) * MARKER_RADIUS;
            const y = Math.sin(deg) * MARKER_RADIUS;
            const isTarget = i === 0;
            const isNeonBlue = i >= 19;
            const isCurrent = val === gameState.currentBlock;

            return { value: val, x, y, isTarget, isNeonBlue, isCurrent };
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
        return await makePayment();
    }, [authState.pubkey, isFrozen, isResolving, gameState.selectedNumber, makePayment, onShowLogin]);



    return (
        <div id="clock">
            {/* Outer ring with block markers */}
            <div id="outerRing" className="ring">
                {markers.map((marker, i) => (
                    <div
                        key={i}
                        className={`block-marker ${marker.isTarget ? 'target' : ''} ${marker.isCurrent ? 'current' : ''} ${marker.isNeonBlue ? 'neon-blue' : ''}`}
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
            <div id="innerCircle" className="inner-ring-container">
                {segments.map(({ num, deg }) => (
                    <div
                        key={num}
                        className={`number-segment ${gameState.selectedNumber === num ? 'selected' : ''}`}
                        style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
                        onClick={() => handleNumberClick(num)}
                    >
                        <div
                            className="number-text"
                            style={{ transform: `rotate(${-deg}deg)` }}
                        >
                            {num}
                        </div>
                    </div>
                ))}
            </div>

            {/* Frozen help button */}
            <div id="frozenHelp" className="help-icon" onClick={(e) => {
                e.stopPropagation();
                onShowFrozenHelp?.();
                setShowFreezeHelpModal(true);
            }}>?</div>

            {/* Center button */}
            <CenterButton
                paymentStatus={paymentStatus}
                paymentError={paymentError}
                loginMethod={authState.loginMethod ?? undefined}
                isFrozen={isFrozen}
                isResolving={isResolving}
                selectedNumber={gameState.selectedNumber}
                pubkey={authState.pubkey ?? undefined}
                onShowLogin={onShowLogin}
                onPaymentStart={handleCenterClick}
            />
            <FreezeHelpModal
                isOpen={showFreezeHelpModal}
                onClose={() => setShowFreezeHelpModal(false)}
            />
        </div>
    );
}
