'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { usePayment } from '../hooks/usePayment';
import { CenterButton } from './CenterButton';
import { FreezeHelpModal } from './modals/FreezeHelpModal';
import { ChangeNumberModal } from './modals/ChangeNumberModal';
import type { Bet } from '../types';

const BLOCKS = 21;
const MARKER_RADIUS = 230;

interface ClockProps {
    onShowLogin?: () => void;
    onShowFrozenHelp?: () => void;
}

export function Clock({ onShowLogin, onShowFrozenHelp }: ClockProps) {
    const { state: authState } = useAuth();
    const { state: gameState, selectNumber, refreshGame, isFrozen, isResolving } = useGame();
    const { makePayment, confirmBet, paymentStatus, paymentError, resetPaymentStatus } = usePayment();
    const [showFreezeHelpModal, setShowFreezeHelpModal] = useState(false);
    const [showChangeModal, setShowChangeModal] = useState(false);
    const [existingBetNumber, setExistingBetNumber] = useState<number | null>(null);
    const [invoiceData, setInvoiceData] = useState<{ paymentRequest: string; paymentHash: string } | null>(null);

    const handleInvoiceGenerated = useCallback((invoice: { paymentRequest: string; paymentHash: string }) => {
        setInvoiceData(invoice);
        localStorage.setItem('satlotto_pending_payment', JSON.stringify(invoice));
    }, []);

    const handleInvoiceClear = useCallback(() => {
        setInvoiceData(null);
        localStorage.removeItem('satlotto_pending_payment');
    }, []);

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

        const existingBet = gameState.bets.find(
            (bet: Bet) => bet.pubkey.toLowerCase() === authState.pubkey?.toLowerCase()
        );

        if (existingBet && Number(existingBet.selected_number) !== gameState.selectedNumber) {
            setExistingBetNumber(Number(existingBet.selected_number));
            setShowChangeModal(true);
            return;
        }

        return await makePayment();
    }, [authState.pubkey, isFrozen, isResolving, gameState.selectedNumber, makePayment, onShowLogin, gameState.bets]);



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
                        className={`number-segment ${gameState.selectedNumber === num ? 'selected' : ''} ${paymentStatus === 'paying' && gameState.selectedNumber === num ? 'paying' : ''} ${paymentStatus === 'error' && gameState.selectedNumber === num ? 'error' : ''}`}
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
                showChangeModal={showChangeModal}
                invoiceData={invoiceData}
                onInvoiceGenerated={handleInvoiceGenerated}
                onInvoiceClear={handleInvoiceClear}
                onShowLogin={onShowLogin}
                onPaymentStart={handleCenterClick}
                onReset={resetPaymentStatus}
                onManualPaymentConfirm={async (paymentHash) => {
                    await confirmBet(paymentHash);
                    await refreshGame();
                }}
            />
            <FreezeHelpModal
                isOpen={showFreezeHelpModal}
                onClose={() => setShowFreezeHelpModal(false)}
            />
            <ChangeNumberModal
                isOpen={showChangeModal}
                oldNumber={existingBetNumber ?? 0}
                newNumber={gameState.selectedNumber ?? 0}
                onConfirm={async () => {
                    setShowChangeModal(false);
                    const result = await makePayment();
                    if (result?.paymentRequest && result?.paymentHash) {
                        handleInvoiceGenerated(result);
                    }
                }}
                onCancel={() => setShowChangeModal(false)}
            />
        </div>
    );
}
