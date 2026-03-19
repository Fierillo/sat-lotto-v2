'use client';

import { Modal } from './Modal';

interface TransparencyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransparencyHelpModal({ isOpen, onClose }: TransparencyHelpModalProps) {
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
      <h2 className="modal-title">Transparencia del pozo</h2>
      <p className="modal-text">
        El pozo acumulado es la suma de todas las apuestas de los ciclos anteriores que no tuvieron ganadores.
      </p>
      <p className="modal-text">
        Cada apuesta contribuye con 21 sats al pozo. Cuando hay un ganador, recibe el pozo completo más sus 21 sats de apuesta.
      </p>
      <p className="modal-text">
        El pozo se reinicia a 0 después de cada sorteo con ganador.
      </p>
    </Modal>
  );
}