'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface PotentialWinnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockHeight: number;
    winningNumber?: number;
    lud16?: string | null;
    pubkey?: string;
    onSaveLN?: (lud16: string) => Promise<{ error?: string }>;
}

export function PotentialWinnerModal({ isOpen, onClose, blockHeight, winningNumber, lud16, pubkey, onSaveLN }: PotentialWinnerModalProps) {
    const [LNAddress, setLNAddress] = useState(lud16 || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (lud16) setLNAddress(lud16);
        setError(null);
        setSuccess(false);
    }, [lud16, isOpen]);

    const handleSaveLN = async () => {
        if (!LNAddress.trim() || !pubkey || !onSaveLN) return;

        setIsSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const result = await onSaveLN(LNAddress.trim());
            if (result.error) {
                setError(result.error);
            } else {
                setSuccess(true);
            }
        } catch (e) {
            console.error('[PotentialWinnerModal] Failed to save LN address:', e);
            setError('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="medium"
            footer={
                lud16 && (
                    <button className="auth-btn" onClick={onClose}>
                        Entendido
                    </button>
                )
            }
        >
            <h2 className="modal-title">✧ Las estrellas han hablado ✧</h2>

            <p className="modal-text" style={{ fontStyle: 'italic', marginBottom: '15px' }}>
                Tu número <strong>{winningNumber}</strong> brilla en el bloque <strong>{blockHeight}</strong>, 
                pero las sombras aún podrían eclipsarlo...
            </p>

            <p className="modal-text" style={{ marginBottom: '20px' }}>
                Cuando Bitcoin confirme 2 bloques más, sabremos si el rayo de luz te encuentra.
            </p>

            <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0, 255, 157, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.3)' }}>
                <p className="modal-text" style={{ marginBottom: '8px', color: '#00ff9d' }}>
                    Tu Lightning Address:
                </p>
                {lud16 && (
                    <p className="modal-text" style={{ fontWeight: 'bold', marginBottom: '15px', fontFamily: 'monospace' }}>
                        {lud16}
                    </p>
                )}
                {!lud16 && (
                    <p className="modal-text" style={{ color: '#ff6b6b', marginBottom: '10px' }}>
                        Aún no tienes una Lightning Address para recibir los sats.
                    </p>
                )}
                <input
                    type="text"
                    placeholder="tu@ejemplo.com"
                    value={LNAddress}
                    onChange={(e) => { setLNAddress(e.target.value); setError(null); setSuccess(false); }}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: `1px solid ${error ? '#ff6b6b' : success ? '#00ff9d' : '#333'}`,
                        background: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        fontSize: '1rem',
                        marginBottom: '10px',
                        boxSizing: 'border-box'
                    }}
                />
                {error && (
                    <p style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '10px' }}>
                        ✗ {error}
                    </p>
                )}
                {success && (
                    <p style={{ color: '#00ff9d', fontSize: '0.85rem', marginBottom: '10px' }}>
                        ✓ Lightning Address guardada
                    </p>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        className="auth-btn" 
                        onClick={handleSaveLN}
                        disabled={isSaving || !LNAddress.trim()}
                        style={{ opacity: (isSaving || !LNAddress.trim()) ? 0.5 : 1 }}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                    {lud16 && (
                        <button 
                            className="auth-btn" 
                            onClick={() => {
                                setLNAddress(lud16 || '');
                            }}
                            style={{ background: 'transparent', border: '1px solid #666' }}
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}