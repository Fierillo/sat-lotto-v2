'use client';

import { useState } from 'react';
import { Modal } from './Modal';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentRequest: string;
  paymentHash: string;
  onPaid?: () => void;
}

export function InvoiceModal({ isOpen, onClose, paymentRequest, paymentHash, onPaid }: InvoiceModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(paymentRequest);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="invoice-modal"
      size="medium"
      footer={
        <>
          {onPaid && (
            <button className="auth-btn" onClick={onPaid}>
              Ya pagué
            </button>
          )}
          <button className="auth-btn" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <h2 className="modal-title">Invoice para pago manual</h2>
      <p className="modal-text">
        Escaneá el código QR o copiá la invoice para pagar con tu wallet Lightning:
      </p>
      
      <div className="qr-container">
        {/* TODO: Generar QR a partir de paymentRequest */}
        <div className="qr-placeholder">
          <div style={{ fontSize: '0.6rem', wordBreak: 'break-all', textAlign: 'center', color: '#000' }}>
            QR: {paymentRequest.substring(0, 30)}...
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '0' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--neon-orange)', textTransform: 'uppercase', display: 'block' }}>Invoice (LNURL o bolt11):</label>
        <code className={`verify-command ${copied ? 'copied' : ''}`} style={{ wordBreak: 'break-all' }} onClick={handleCopy}>
          {paymentRequest}
        </code>
        <div className={`copy-status ${copied ? 'show' : ''}`} style={{ opacity: copied ? 1 : 0 }}>¡Copiado! ⚡</div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', marginBottom: '15px', lineHeight: '1.2', textAlign: 'center' }}>
        Esta invoice expira en 10 minutos. Una vez pagada, la apuesta se confirmará automáticamente.
      </p>
    </Modal>
  );
}