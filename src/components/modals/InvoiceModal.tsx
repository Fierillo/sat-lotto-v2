'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { CopyText } from '../CopyText';
import qrcode from 'qrcode-generator';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentRequest: string;
  paymentHash: string;
  onPaid?: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIME_MS = 600000;

const STORAGE_KEY = 'satlotto_pending_payment';

export function InvoiceModal({ isOpen, onClose, paymentRequest, paymentHash, onPaid }: InvoiceModalProps) {
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const qrDataUrl = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(paymentRequest);
    qr.make();
    return qr.createDataURL(3, 0);
  }, [paymentRequest]);

  useEffect(() => {
    if (isOpen) {
      setPaid(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ paymentRequest, paymentHash }));
    }
  }, [isOpen, paymentRequest, paymentHash]);

  const clearPending = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleClose = () => {
    clearPending();
    onClose();
  };

  const checkPayment = async () => {
    if (checking || paid) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/bet?paymentHash=${paymentHash}`);
      const data = await res.json();
      if (data.confirmed || data.settled) {
        setPaid(true);
        clearPending();
        try {
          await onPaid?.();
        } catch (e) {
          console.error('[InvoiceModal] onPaid error:', e);
        }
        onClose();
      }
    } catch (e) {
      console.error('[InvoiceModal] Error checking payment:', e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isOpen || paid) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    startTimeRef.current = Date.now();
    checkPayment();
    intervalRef.current = setInterval(() => {
      if (Date.now() - startTimeRef.current > MAX_POLL_TIME_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      checkPayment();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, paid]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="invoice-modal"
      size="medium"
      footer={
        <button className="auth-btn" onClick={handleClose} style={{ background: '#e74c3c' }}>
          Cancelar
        </button>
      }
    >
      <h2 className="modal-title">Invoice para pago manual</h2>
      <p className="modal-text">
        Escaneá el código QR o copiá la invoice para pagar con tu wallet Lightning:
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="qr-container" style={{ background: '#fff', padding: '8px', borderRadius: '4px' }}>
          <img src={qrDataUrl} alt="Invoice QR" />
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <CopyText text={paymentRequest} truncate={80} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '3px solid var(--neon-green)', 
          borderTop: '3px solid transparent', 
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span style={{ color: 'var(--neon-green)', fontWeight: 'bold' }}>
          Esperando pago...
        </span>
      </div>

      {paid && (
        <p style={{ fontSize: '0.85rem', color: 'var(--neon-green)', marginTop: '12px', textAlign: 'center', fontWeight: 'bold' }}>
          ¡Pago confirmado! Cerrando...
        </p>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '12px', lineHeight: '1.2', textAlign: 'center' }}>
        Esta invoice expira en 10 minutos. Una vez pagada, se cerrará automáticamente.
      </p>
    </Modal>
  );
}