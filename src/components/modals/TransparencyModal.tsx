'use client';

import { useState } from 'react';
import { Modal } from './Modal';

interface TransparencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  winningNumber?: number;
  targetBlock: number;
  blockHash?: string;
}

export function TransparencyModal({
  isOpen,
  onClose,
  winningNumber,
  targetBlock,
  blockHash,
}: TransparencyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!blockHash) return;
    const formula = `BigInt('0x${blockHash}') % 21n + 1n`;
    await navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="auth-modal"
      size="medium"
      footer={
        <button className="auth-btn" onClick={onClose}>
          Entendido
        </button>
      }
    >
      <h2 className="modal-title">Transparencia</h2>
      <p className="modal-text">
        El número ganador <strong>{winningNumber ?? 'N/A'}</strong> se obtiene a partir del hash del último bloque en que se sorteo (<b>{Math.floor(targetBlock)}</b>):
      </p>
      
      {blockHash && (
        <div className="modal-hash">
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-dim)' }}>{blockHash}</div>
        </div>
      )}

      <div style={{ marginBottom: '0' }}>
        <label style={{ fontSize: '0.72rem', color: 'var(--neon-orange)', textTransform: 'uppercase', display: 'block' }}>Verificalo vos mismo:</label>
        <code className={`verify-command ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          BigInt('0x{blockHash}') % 21n + 1n
        </code>
        <div className={`copy-status ${copied ? 'show' : ''}`} style={{ opacity: copied ? 1 : 0 }}>¡Copiado! ⚡</div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', marginBottom: '15px', lineHeight: '1.2', textAlign: 'center' }}>
        Copiá y pegá la fórmula en la consola (F12) o en tu terminal para verificar el resultado exacto.
      </p>
    </Modal>
  );
}