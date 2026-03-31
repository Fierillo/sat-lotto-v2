'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';

interface ChampionModalProps {
    isOpen: boolean;
    onClose: () => void;
    satsWon: number;
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
    pendingAmount?: number;
    onClaim?: () => Promise<{ claimed: number; error?: string }>;
    onSaveLN?: (lud16: string) => Promise<{ error?: string }>;
}

const LN_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

async function checkLNReachability(address: string): Promise<boolean> {
    try {
        const [user, domain] = address.split('@');
        const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.callback;
    } catch {
        return false;
    }
}

export function ChampionModal({
    isOpen,
    onClose,
    satsWon,
    lud16,
    pubkey,
    blockHeight,
    pendingAmount = 0,
    onClaim,
    onSaveLN
}: ChampionModalProps) {
    const [LNAddress, setLNAddress] = useState(lud16 || '');
    const [isValidFormat, setIsValidFormat] = useState(false);
    const [isReachable, setIsReachable] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimResult, setClaimResult] = useState<{ claimed?: number; error?: string } | null>(null);
    const [showClaimSuccess, setShowClaimSuccess] = useState(false);

    useEffect(() => {
        if (lud16) setLNAddress(lud16);
    }, [lud16]);

    useEffect(() => {
        setIsValidFormat(LN_REGEX.test(LNAddress.trim()));
    }, [LNAddress]);

    useEffect(() => {
        if (!isValidFormat) {
            setIsReachable(false);
            return;
        }

        let cancelled = false;
        setIsChecking(true);

        checkLNReachability(LNAddress.trim()).then(reachable => {
            if (!cancelled) {
                setIsReachable(reachable);
                setIsChecking(false);
            }
        });

        return () => { cancelled = true; };
    }, [LNAddress, isValidFormat]);

    const handleSaveLN = useCallback(async () => {
        if (!LNAddress.trim() || !onSaveLN || !isValidFormat || !isReachable) return;

        setIsSaving(true);
        try {
            const result = await onSaveLN(LNAddress.trim());
            if (result.error) {
                setClaimResult({ error: result.error });
            } else {
                setClaimResult(null);
            }
        } catch (e) {
            console.error('[ChampionModal] Failed to save LN address:', e);
        } finally {
            setIsSaving(false);
        }
    }, [LNAddress, onSaveLN, isValidFormat, isReachable]);

    const handleClaim = useCallback(async () => {
        if (!onClaim || isClaiming) return;

        setIsClaiming(true);
        setClaimResult(null);
        try {
            const result = await onClaim();
            setClaimResult(result);
            if (result.claimed > 0) {
                setShowClaimSuccess(true);
            }
        } finally {
            setIsClaiming(false);
        }
    }, [onClaim, isClaiming]);

    const canSave = isValidFormat && isReachable && !isChecking && !isSaving;
    const hasLud16 = !!lud16;
    const showPendingSection = hasLud16 && pendingAmount > 0 && !showClaimSuccess;
    const showSavedSuccess = hasLud16 && !showPendingSection && !claimResult?.error;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="medium"
            footer={
                <button className="auth-btn" onClick={onClose}>
                    Cerrar
                </button>
            }
        >
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🏆</div>
                <h2 className="modal-title" style={{ color: '#f7931a', fontSize: '2rem', marginBottom: '20px' }}>
                    ¡CAMPEÓN!
                </h2>
                <p className="modal-text" style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
                    Ganaste <strong style={{ color: '#00ff9d', fontSize: '1.5rem' }}>{satsWon.toLocaleString()}</strong> sats
                </p>
                <p className="modal-text" style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px' }}>
                    Ronda #{blockHeight}
                </p>

                <div style={{ marginBottom: '15px' }}>
                    <p className="modal-text" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                        Lightning Address:
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="tu@ejemplo.com"
                            value={LNAddress}
                            onChange={(e) => {
                                setLNAddress(e.target.value);
                                setClaimResult(null);
                                setShowClaimSuccess(false);
                            }}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '6px',
                                border: `1px solid ${!LNAddress.trim() ? '#333' : isValidFormat ? (isReachable ? '#00ff9d' : '#ff6b6b') : '#ff6b6b'}`,
                                background: 'rgba(0,0,0,0.5)',
                                color: '#fff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            className="auth-btn small"
                            onClick={handleSaveLN}
                            disabled={!canSave}
                            style={{
                                opacity: canSave ? 1 : 0.5,
                                minWidth: '80px',
                                padding: '10px 16px'
                            }}
                        >
                            {isSaving ? '...' : isChecking ? '...' : 'Guardar'}
                        </button>
                    </div>
                    {LNAddress.trim() && !isValidFormat && (
                        <p style={{ color: '#ff6b6b', fontSize: '0.75rem', marginTop: '4px' }}>
                            Formato inválido (ej: usuario@wallet.io)
                        </p>
                    )}
                    {isValidFormat && !isReachable && !isChecking && (
                        <p style={{ color: '#ff6b6b', fontSize: '0.75rem', marginTop: '4px' }}>
                            Lightning address no encontrado
                        </p>
                    )}
                </div>

                {showPendingSection && (
                    <div style={{ marginTop: '15px' }}>
                        <button
                            className="auth-btn"
                            onClick={handleClaim}
                            disabled={isClaiming}
                            style={{
                                background: isClaiming ? undefined : 'rgba(0, 255, 157, 0.2)',
                                borderColor: '#00ff9d',
                                opacity: isClaiming ? 0.7 : 1
                            }}
                        >
                            {isClaiming ? 'Procesando...' : `Reclamar ${pendingAmount.toLocaleString()} sats`}
                        </button>
                    </div>
                )}

                {claimResult?.error && (
                    <div style={{ marginTop: '10px', color: '#ff6b6b', fontSize: '0.85rem' }}>
                        {claimResult.error}
                    </div>
                )}

                {showClaimSuccess && (
                    <div style={{
                        marginTop: '15px',
                        background: 'rgba(0, 255, 157, 0.1)',
                        border: '1px solid #00ff9d',
                        borderRadius: '8px',
                        padding: '15px'
                    }}>
                        <p style={{ color: '#00ff9d', fontWeight: 'bold' }}>
                            ¡{claimResult?.claimed?.toLocaleString()} sats enviadas!
                        </p>
                        <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '5px' }}>
                            a {lud16}
                        </p>
                    </div>
                )}

                {showSavedSuccess && !showClaimSuccess && (
                    <div style={{
                        marginTop: '15px',
                        background: 'rgba(0, 255, 157, 0.1)',
                        border: '1px solid #00ff9d',
                        borderRadius: '8px',
                        padding: '15px'
                    }}>
                        <p className="modal-text" style={{ marginBottom: '5px' }}>
                            Fondos enviados a:
                        </p>
                        <p style={{ color: '#00ff9d', fontWeight: 'bold', wordBreak: 'break-all' }}>
                            {lud16}
                        </p>
                    </div>
                )}

                <p className="modal-text" style={{ fontSize: '0.8rem', color: '#666', marginTop: '20px' }}>
                    ¡Gracias por jugar a SatLotto!
                </p>
            </div>
        </Modal>
    );
}
