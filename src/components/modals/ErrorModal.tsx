'use client';

import { Modal } from './Modal';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null | undefined;
}

export function ErrorModal({ isOpen, onClose, error }: ErrorModalProps) {
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
      <h2>Error en el pago</h2>
      <p>{error ?? 'Ha ocurrido un error desconocido durante el pago.'}</p>
    </Modal>
  );
}