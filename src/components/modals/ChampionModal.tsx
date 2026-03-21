'use client';

import { useState } from 'react';
import { Modal } from './Modal';

interface ChampionModalProps {
    isOpen: boolean;
    onClose: () => void;
    satsWon: number;
    lud16?: string | null;
    pubkey?: string;
    blockHeight: number;
}

export function ChampionModal({ isOpen, onClose, satsWon, lud16, pubkey, blockHeight }: ChampionModalProps) {
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
            console.error('[ChampionModal] Failed to save LN address:', e);
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

                {lud16 ? (
                    <div style={{ 
                        background: 'rgba(0, 255, 157, 0.1)', 
                        border: '1px solid #00ff9d', 
                        borderRadius: '8px', 
                        padding: '15px',
                        marginBottom: '10px'
                    }}>
                        <p className="modal-text" style={{ marginBottom: '5px' }}>
                            Los fondos fueron enviados a:
                        </p>
                        <p style={{ color: '#00ff9d', fontWeight: 'bold', wordBreak: 'break-all' }}>
                            {lud16}
                        </p>
                    </div>
                ) : (
                    <div style={{ marginBottom: '10px' }}>
                        <p className="modal-text" style={{ color: '#ff6b6b', marginBottom: '10px' }}>
                            No tenés una dirección Lightning configurada.
                        </p>
                        <p className="modal-text" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                            Ingresá tu Lightning Address para recibir los sats:
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

                <p className="modal-text" style={{ fontSize: '0.8rem', color: '#666', marginTop: '20px' }}>
                    ¡Gracias por jugar a SatLotto!
                </p>
            </div>
        </Modal>
    );
}
