'use client';

import { Modal } from './Modal';

interface ChangeNumberModalProps {
    isOpen: boolean;
    oldNumber: number;
    newNumber: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ChangeNumberModal({ isOpen, oldNumber, newNumber, onConfirm, onCancel }: ChangeNumberModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onCancel}>
            <h2 style={{ color: '#f7931a' }}>¿Cambiar apuesta?</h2>
            <p style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.7)' }}>
                Ya tienes una apuesta al <strong className="text-green">{oldNumber}</strong>.<br /><br />
                Si continúas, la cambiaremos por el <strong className="text-orange">{newNumber}</strong>.<br />
                <small>(Deberás pagar un nuevo ticket)</small>
            </p>
            <button className="auth-btn" onClick={onConfirm}>CAMBIAR</button>
            <button className="close-btn" onClick={onCancel} style={{ marginTop: '10px' }}>Cancelar</button>
        </Modal>
    );
}
