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
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 15px',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 30px rgba(247, 147, 26, 0.3), 0 0 60px rgba(247, 147, 26, 0.1)',
          border: '2px solid rgba(247, 147, 26, 0.3)',
        }}>
          <img
            src="/treasure-chest.svg"
            alt="Cofre del tesoro"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
        <h2 className="modal-title" style={{ marginBottom: '5px' }}>✧ El misterio del pozo ✧</h2>
      </div>

      <p className="modal-text" style={{ textAlign: 'center', fontSize: '1rem', marginBottom: '15px' }}>
        ¿Por qué tu apuesta no suma 21 sats?
      </p>

      <div style={{
        background: 'rgba(247, 147, 26, 0.1)',
        border: '1px solid rgba(247, 147, 26, 0.2)',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Tu apuesta:</span>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>21 sats</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Pozo ancestral:</span>
          <span style={{ color: '#00ff9d', fontWeight: 'bold' }}>19 sats</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Comisión cósmica:</span>
          <span style={{ color: '#b026ff', fontWeight: 'bold' }}>2 sats</span>
        </div>
      </div>

      <p className="modal-text" style={{ fontStyle: 'italic' }}>
        De cada apuesta, 2 sats son apartados como comisión cósmica para mantener el ritual funcionando. Solo 19 sats se unen al pozo ancestral.
      </p>
      <p className="modal-text" style={{ fontStyle: 'italic' }}>
        Cuando la luz elija a un ganador, recibirá el pozo completo más sus 19 sats devueltos.
      </p>
    </Modal>
  );
}
