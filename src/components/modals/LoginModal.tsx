'use client';

import { Modal } from './Modal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="auth-modal"
      size="medium"
      footer={
        <button className="auth-btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <h2>Conectá tu Wallet</h2>
      <p>Login modal - TODO: implement</p>
    </Modal>
  );
}