'use client';

import { useState } from 'react';
import { Modal } from './Modal';

interface PotentialWinnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockHeight: number;
    winningNumber?: number;
    lud16?: string | null;
    pubkey?: string;
}

export function PotentialWinnerModal({ isOpen, onClose, blockHeight, winningNumber, lud16, pubkey }: PotentialWinnerModalProps) {
    const [LNAddress, setLNAddress] = useState(lud16 || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveLN = async () => {
        if (!LNAddress.trim() || !pubkey) return;
        
        setIsSaving(true);
        try {
            await fetch(`/api/identity/${pubkey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lud16: LNAddress.trim() })
            });
        } catch (e) {
            console.error('[PotentialWinnerModal] Failed to save LN address:', e);
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
                <button className="auth-btn" onClick={onClose}>
                    Entendido
                </button>
            }
        >
            <h2 className="modal-title">¡Posible ganador!</h2>
            <p className="modal-text">
                Tu apuesta coincide con el número ganador del bloque {blockHeight}.
                {winningNumber !== undefined && (
                    <> Número ganador: <strong>{winningNumber}</strong>.</>
                )}
            </p>
            <p className="modal-text">
                Esperá a que el bloque tenga al menos 2 confirmaciones para asegurar que no haya reorgs.
            </p>
            <p className="modal-text">
                Si tu apuesta sigue siendo válida después de las confirmaciones, recibirás el pozo automáticamente.
            </p>

            {!lud16 && pubkey && (
                <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px' }}>
                    <p className="modal-text" style={{ color: '#ff6b6b', marginBottom: '10px' }}>
                        No tenés una dirección Lightning configurada.
                    </p>
                    <p className="modal-text" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                        Ingresá tu Lightning Address para recibir los sats cuando se confirme:
                    </p>
                    <input
                        type="text"
                        placeholder="tu@ejemplo.com"
                        value={LNAddress}
                        onChange={(e) => setLNAddress(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #333',
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            fontSize: '1rem',
                            marginBottom: '10px',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button 
                        className="auth-btn" 
                        onClick={handleSaveLN}
                        disabled={isSaving || !LNAddress.trim()}
                        style={{ opacity: (isSaving || !LNAddress.trim()) ? 0.5 : 1 }}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            )}
        </Modal>
    );
}
