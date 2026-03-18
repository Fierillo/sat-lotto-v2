'use client';

import { useEffect, useRef } from 'react';

interface JackpotPanelProps {
    poolBalance: number;
    onShowHelp?: () => void;
}

export function JackpotPanel({ poolBalance, onShowHelp }: JackpotPanelProps) {
    const amountRef = useRef<HTMLDivElement>(null);

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
        <div className="pool-panel">
            <div className="pool-title">
                POZO ACUMULADO
                {onShowHelp && (
                    <span className="help-icon" style={{ marginLeft: '5px' }} onClick={onShowHelp}>?</span>
                )}
            </div>
            <div className="pool-amount" ref={amountRef}>
                <span id="poolSats">{poolBalance.toLocaleString('en-US')}</span>{' '}
                <span className="sats-label">sats</span>
            </div>
        </div>
    );
}
