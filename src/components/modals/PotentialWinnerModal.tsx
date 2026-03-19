'use client';

import { Modal } from './Modal';

interface PotentialWinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockHeight: number;
  winningNumber?: number;
}

export function PotentialWinnerModal({ isOpen, onClose, blockHeight, winningNumber }: PotentialWinnerModalProps) {
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
    </Modal>
  );
}