'use client';

import { useEffect, useRef, useState } from 'react';
import { TransparencyHelpModal } from './modals/TransparencyHelpModal';

interface JackpotPanelProps {
    poolBalance: number;
}

export function JackpotPanel({ poolBalance }: JackpotPanelProps) {
    const amountRef = useRef<HTMLDivElement>(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        if (amountRef.current) {
            amountRef.current.classList.add('update-glow');
            const timer = setTimeout(() => {
                amountRef.current?.classList.remove('update-glow');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [poolBalance]);

    return (
        <>
            <div className="pool-panel">
                <div className="pool-title">
                    POZO ACUMULADO
                    <span className="help-icon" style={{ marginLeft: '5px' }} onClick={(e) => {
                        e.stopPropagation();
                        setShowHelpModal(true);
                    }}>?</span>
                </div>
                <div className="pool-amount" ref={amountRef}>
                    <span id="poolSats">{poolBalance.toLocaleString('en-US')}</span>{' '}
                    <span className="sats-label">sats</span>
                </div>
            </div>
            <TransparencyHelpModal
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
            />
        </>
    );
}
