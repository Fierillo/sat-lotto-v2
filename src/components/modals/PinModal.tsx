'use client';

import { useState, useRef, useEffect } from 'react';

interface PinModalProps {
    mode: 'create' | 'verify';
    error: string | null;
    attemptsLeft: number;
    onVerify: (pin: string) => Promise<boolean>;
    onCreate: (pin: string) => Promise<boolean>;
    onCancel: () => void;
}

export function PinModal({ mode, error, attemptsLeft, onVerify, onCreate, onCancel }: PinModalProps) {
    const [pin, setPin] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const pinRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    useEffect(() => {
        setPin(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 50);
    }, [mode]);

    useEffect(() => {
        if (error) {
            setPin(['', '', '', '']);
            setTimeout(() => pinRefs[0].current?.focus(), 100);
        }
    }, [error]);

    const handlePinChange = (index: number, value: string) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newPin = [...pin];
            newPin[index] = value;
            setPin(newPin);

            if (value && index < 3 && pinRefs[index + 1].current) {
                pinRefs[index + 1].current!.focus();
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0 && pinRefs[index - 1].current) {
            pinRefs[index - 1].current!.focus();
        }
    };

    const handleSubmit = async () => {
        const fullPin = pin.join('');
        if (fullPin.length !== 4) return;

        setLoading(true);
        try {
            if (mode === 'create') {
                await onCreate(fullPin);
            } else {
                await onVerify(fullPin);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-bg" onClick={onCancel}>
            <div className="modal pin-modal" onClick={(e) => e.stopPropagation()}>
                <h2 id="pinTitle">
                    {mode === 'create' ? 'Creá tu PIN' : 'Seguridad de la Wallet'}
                </h2>
                <p id="pinDesc" className="pin-desc">
                    {mode === 'create'
                        ? 'Este PIN de 4 dígitos protege tu wallet. Guardalo bien.'
                        : 'Ingresá el PIN de 4 dígitos para desbloquear tu wallet.'}
                </p>

                <div className="pin-input-container">
                    {pin.map((digit, index) => (
                        <input
                            key={index}
                            ref={pinRefs[index]}
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="pin-digit"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handlePinChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            disabled={loading || attemptsLeft === 0}
                        />
                    ))}
                </div>

                {error && <p className="auth-error">{error}</p>}

                <div className="pin-buttons">
                    <button className="auth-btn secondary" onClick={onCancel}>
                        Cancelar
                    </button>
                    <button
                        className="auth-btn"
                        onClick={handleSubmit}
                        disabled={loading || pin.join('').length !== 4 || attemptsLeft === 0}
                    >
                        {loading ? '...' : mode === 'create' ? 'Crear PIN' : 'Desbloquear'}
                    </button>
                </div>

                {mode === 'verify' && attemptsLeft < 3 && !error && (
                    <p className="pin-attempts">
                        Intentos restantes: {attemptsLeft}
                    </p>
                )}
            </div>
        </div>
    );
}
