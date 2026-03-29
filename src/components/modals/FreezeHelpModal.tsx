'use client';

import { Modal } from './Modal';

interface FreezeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FreezeHelpModal({ isOpen, onClose }: FreezeHelpModalProps) {
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
      <h2 className="modal-title">Fase de congelamiento</h2>
      <p className="modal-text">
        El reloj está en fase de congelamiento porque el sorteo está por comenzar o está en proceso.
      </p>
      <p className="modal-text">
        En esta fase no se pueden realizar nuevas apuestas para asegurar la integridad del sorteo.
      </p>
      <p className="modal-text">
        Esperá a que termine el sorteo y se revele el número ganador para volver a apostar.
      </p>
    </Modal>
  );
}