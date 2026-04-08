'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { createNwcInvoice } from '../../lib/nwc';

interface ChampionModalProps {
    isOpen: boolean;
    onClose: () => void;
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
    sats_pending?: number;
    onClaim?: () => Promise<{ claimed: number; error?: string }>;
    onSaveLN?: (lud16: string) => Promise<{ error?: string }>;
    openPinModal?: (payload: { mode: 'create' | 'verify'; callback?: () => Promise<{ claimed: number; error?: string }> }) => void;
    showPinInput?: boolean;
    isNwcUser?: boolean;
}

const LN_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

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
    lud16,
    pubkey,
    blockHeight,
    sats_pending = 0,
    onClaim,
    onSaveLN,
    openPinModal,
    showPinInput,
    isNwcUser
}: ChampionModalProps) {
    const displayLNAddress = !lud16 || isNwcUser ? '' : lud16;
    const [LNAddress, setLNAddress] = useState(displayLNAddress);
    const [isValidFormat, setIsValidFormat] = useState(false);
    const [isReachable, setIsReachable] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimResult, setClaimResult] = useState<{ claimed?: number; error?: string } | null>(null);
    const [showClaimSuccess, setShowClaimSuccess] = useState(false);
    const [savedLN, setSavedLN] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (isNwcUser) {
                setLNAddress('');
                setSavedLN(false);
            } else if (lud16) {
                setLNAddress(lud16);
                setSavedLN(true);
            } else {
                setLNAddress('');
                setSavedLN(false);
            }
            setIsEditing(false);
            setClaimResult(null);
            setShowClaimSuccess(false);
        }
    }, [isOpen, lud16, isNwcUser]);

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
        if (!LNAddress.trim() || !onSaveLN || !isValidFormat) return;

        setIsSaving(true);
        try {
            const result = await onSaveLN(LNAddress.trim());
            if (result.error) {
                setClaimResult({ error: result.error });
            } else {
                setClaimResult(null);
                setSavedLN(true);
                setIsEditing(false);
            }
        } catch (e) {
            console.error('[ChampionModal] Failed to save LN address:', e);
        } finally {
            setIsSaving(false);
        }
    }, [LNAddress, onSaveLN, isValidFormat]);

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

    const handlePinClaim = useCallback(async () => {
        if (!openPinModal || !pubkey || isClaiming) return;

        const claimCallback = async () => {
            const nwcUrl = (window as any).__auth_nwcUrl;
            if (!nwcUrl) {
                return { claimed: 0, error: 'No hay wallet conectada' };
            }

            setIsClaiming(true);
            setClaimResult(null);
            try {
                const identityRes = await fetch(`/api/identity/${pubkey}`);
                const identityData = await identityRes.json();
                const satsPending = identityData.sats_pending || 0;

                if (satsPending <= 0) {
                    return { claimed: 0, error: 'No hay premio pendiente' };
                }

                const invoiceData = await createNwcInvoice(
                    nwcUrl, 
                    satsPending, 
                    `SatLotto Prize - Block ${identityData.winner_block}`
                );

                const claimRes = await fetch(`/api/identity/${pubkey}/claim`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice: invoiceData.invoice })
                });
                const claimData = await claimRes.json();

                if (!claimRes.ok) {
                    setClaimResult({ error: claimData.error });
                    return { claimed: 0, error: claimData.error };
                }
                
                setClaimResult({ claimed: claimData.claimed });
                setShowClaimSuccess(true);
                return { claimed: claimData.claimed };
            } catch (err) {
                const errorMsg = 'Error al reclamar premio';
                setClaimResult({ error: errorMsg });
                return { claimed: 0, error: errorMsg };
            } finally {
                setIsClaiming(false);
            }
        };

        openPinModal({ mode: 'verify', callback: claimCallback });
    }, [openPinModal, pubkey, isClaiming]);

    const handleEdit = () => {
        setIsEditing(true);
        setClaimResult(null);
    };

    const canSave = isValidFormat && !isChecking && !isSaving && (isEditing || !savedLN) && !isNwcUser;
    const showClaimButton = isNwcUser 
        ? (sats_pending > 0 && !showClaimSuccess)
        : (savedLN && !isEditing && sats_pending > 0 && !showClaimSuccess);
    const showEditButton = savedLN && !isEditing && !isNwcUser;
    const showSaveButton = (!savedLN || isEditing) && !isNwcUser;
    const showConfirmMessage = savedLN && !isEditing && !showClaimSuccess && !isNwcUser;
    const showClaimSuccessMessage = showClaimSuccess && claimResult?.claimed;
    const showErrorMessage = claimResult?.error && !showClaimSuccess;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="medium"
            footer={
                <button className="auth-btn" onClick={onClose} style={{ background: '#ff6b6b', borderColor: '#ff6b6b' }}>
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
                    Ganaste <strong style={{ color: '#00ff9d', fontSize: '1.5rem' }}>{sats_pending.toLocaleString()}</strong> sats
                </p>
                <p className="modal-text" style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px' }}>
                    Ronda #{blockHeight}
                </p>

                {isNwcUser ? (
                    <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(0,255,157,0.1)', borderRadius: '6px' }}>
                        <p style={{ color: '#00ff9d', fontSize: '0.9rem' }}>
                            💰 El premio se enviará a tu wallet (NWC)
                        </p>
                        <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '5px' }}>
                            Se te pedirà tu PIN para reclamar
                        </p>
                    </div>
                ) : (
                <div style={{ marginBottom: '15px' }}>
                    <p className="modal-text" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                        Lightning Address:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="tu@ejemplo.com"
                            value={LNAddress}
                            onChange={(e) => {
                                setLNAddress(e.target.value);
                                setClaimResult(null);
                            }}
                            disabled={savedLN && !isEditing}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '6px',
                                border: `1px solid ${!LNAddress.trim() ? '#333' : isValidFormat ? (isReachable || !isChecking ? '#00ff9d' : '#ffa500') : '#ff6b6b'}`,
                                background: 'rgba(0,0,0,0.5)',
                                color: '#fff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box',
                                opacity: savedLN && !isEditing ? 0.7 : 1
                            }}
                        />
                        {showSaveButton && (
                            <button
                                className="auth-btn small"
                                onClick={handleSaveLN}
                                disabled={!canSave}
                                style={{
                                    opacity: canSave ? 1 : 0.5,
                                    padding: '10px 16px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {isSaving ? '...' : isChecking ? '...' : 'Guardar'}
                            </button>
                        )}
                        {showEditButton && (
                            <button
                                className="auth-btn small"
                                onClick={handleEdit}
                                style={{
                                    padding: '10px 12px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                ✏️
                            </button>
                        )}
                    </div>
                    {LNAddress.trim() && !isValidFormat && (
                        <p style={{ color: '#ff6b6b', fontSize: '0.75rem', marginTop: '4px' }}>
                            Formato inválido (ej: usuario@wallet.io)
                        </p>
                    )}
                    {isValidFormat && !isReachable && !isChecking && !savedLN && (
                        <p style={{ color: '#ffa500', fontSize: '0.75rem', marginTop: '4px' }}>
                            ⚠️ No se pudo verificar la dirección. Posible problema de CORS.
                        </p>
                    )}
                </div>
                )}

                {showConfirmMessage && (
                    <div style={{
                        marginTop: '10px',
                        marginBottom: '15px',
                        padding: '10px',
                        background: 'rgba(0, 255, 157, 0.1)',
                        border: '1px solid #00ff9d',
                        borderRadius: '6px'
                    }}>
                        <p style={{ color: '#00ff9d', fontSize: '0.85rem' }}>
                            ✓ LN Address confirmada
                        </p>
                    </div>
                )}

                {isClaiming && (
                    <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        background: 'rgba(255, 193, 7, 0.1)',
                        border: '1px solid #ffc107',
                        borderRadius: '8px'
                    }}>
                        <p style={{ color: '#ffc107', fontSize: '0.9rem' }}>
                            ⏳ Enviando {sats_pending.toLocaleString()} sats...
                        </p>
                    </div>
                )}

                {showClaimButton && !isClaiming && (
                    <div style={{ marginTop: '15px' }}>
                        <button
                            className="auth-btn"
                            onClick={showPinInput ? handlePinClaim : handleClaim}
                            disabled={isClaiming}
                            style={{
                                background: 'rgba(0, 255, 157, 0.2)',
                                borderColor: '#00ff9d',
                                opacity: isClaiming ? 0.7 : 1
                            }}
                        >
                            {isClaiming ? 'Procesando...' : 'Reclamar premio'}
                        </button>
                    </div>
                )}

                {showErrorMessage && (
                    <div style={{
                        marginTop: '10px',
                        color: '#ff6b6b',
                        fontSize: '0.85rem',
                        padding: '10px',
                        background: 'rgba(255, 107, 107, 0.1)',
                        borderRadius: '6px'
                    }}>
                        ✗ {claimResult.error}
                    </div>
                )}

                {showClaimSuccessMessage && (
                    <div style={{
                        marginTop: '15px',
                        background: 'rgba(0, 255, 157, 0.1)',
                        border: '1px solid #00ff9d',
                        borderRadius: '8px',
                        padding: '15px'
                    }}>
                        <p style={{ color: '#00ff9d', fontWeight: 'bold', fontSize: '1rem' }}>
                            ✓ ¡{claimResult?.claimed?.toLocaleString()} sats enviados!
                        </p>
                        {LNAddress && !isNwcUser && (
                            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '5px' }}>
                                a {LNAddress}
                            </p>
                        )}
                    </div>
                )}

                <p className="modal-text" style={{ fontSize: '0.8rem', color: '#666', marginTop: '20px' }}>
                    ¡Gracias por jugar a SatLotto!
                </p>
            </div>
        </Modal>
    );
}