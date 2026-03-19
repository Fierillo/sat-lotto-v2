'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from './modals/Modal';
import { ErrorModal } from './modals/ErrorModal';
import { InvoiceModal } from './modals/InvoiceModal';
import type { PaymentStatus } from '../hooks/usePayment';

interface CenterButtonProps {
  paymentStatus: PaymentStatus;
  paymentError?: string | null;
  loginMethod?: string;
  isFrozen: boolean;
  isResolving: boolean;
  selectedNumber: number | null;
  pubkey?: string;
  onShowLogin?: () => void;
  onPaymentStart: () => Promise<any>;
}

export function CenterButton({
  paymentStatus,
  paymentError,
  loginMethod,
  isFrozen,
  isResolving,
  selectedNumber,
  pubkey,
  onShowLogin,
  onPaymentStart,
}: CenterButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [keepGlow, setKeepGlow] = useState<'success' | 'error' | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{ paymentRequest: string; paymentHash: string } | null>(null);

  // Manage body.processing class
  useEffect(() => {
    const body = document.body;
    const isProcessing = paymentStatus === 'signing' || paymentStatus === 'paying';
    body.classList.toggle('processing', isProcessing);
    return () => {
      body.classList.remove('processing');
    };
  }, [paymentStatus]);

  // Manage glow classes for success/error states
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    if (paymentStatus === 'success' || paymentStatus === 'error') {
      setKeepGlow(paymentStatus);
    } else {
      setKeepGlow(null);
    }
  }, [paymentStatus]);

  // Apply glow classes
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    button.classList.toggle('success-glow', keepGlow === 'success');
    button.classList.toggle('error-glow', keepGlow === 'error');
  }, [keepGlow]);

  // Determine button visibility
  const shouldShow = !pubkey || isFrozen || isResolving || selectedNumber !== null || paymentStatus === 'success' || paymentStatus === 'error';

  if (!shouldShow) return null;

  let disabled = false;
  let buttonClass = 'pay-btn';
  let buttonContent: React.ReactNode = null;

  if (!pubkey) {
    buttonContent = 'JUGAR';
    disabled = false;
  } else if (isResolving) {
    buttonContent = <span>FIN DE<br />RONDA</span>;
    buttonClass += ' frozen';
    disabled = true;
  } else if (isFrozen) {
    buttonContent = <span>NO PODÉS<br />APOSTAR</span>;
    buttonClass += ' frozen';
    disabled = true;
  } else {
    switch (paymentStatus) {
      case 'idle':
        buttonContent = 'APOSTAR';
        break;
      case 'signing':
        buttonContent = 'FIRMANDO...';
        disabled = true;
        break;
      case 'paying':
        if (loginMethod === 'nwc') {
          buttonContent = 'PAGANDO CON NWC...';
          buttonClass += ' blink-purple';
        } else if (loginMethod === 'nip07') {
          buttonContent = 'PAGANDO CON EXTENSIÓN...';
        } else if (loginMethod === 'amber') {
          buttonContent = 'PAGANDO CON AMBER...';
        } else {
          buttonContent = 'PAGANDO...';
        }
        disabled = true;
        break;
      case 'success':
        buttonContent = '¡PAGADO!';
        disabled = true;
        break;
      case 'error':
        buttonContent = 'ERROR (clic para detalles)';
        disabled = false;
        break;
      default:
        buttonContent = 'APOSTAR';
    }
  }

  const handleClick = async () => {
    if (disabled) return;
    if (isFrozen || isResolving) return;
    if (paymentStatus === 'error') {
      setShowErrorModal(true);
      return;
    }
    if (!pubkey) {
      onShowLogin?.();
      return;
    }
    if (paymentStatus === 'idle' && selectedNumber !== null) {
      const result = await onPaymentStart();
      if (result && typeof result === 'object' && 'paymentRequest' in result && 'paymentHash' in result) {
        setInvoiceData(result);
        setShowInvoiceModal(true);
      }
    }
  };

  return (
    <>
      <div id="paymentStep">
        <button
          ref={buttonRef}
          id="centerBtn"
          className={buttonClass}

          onClick={handleClick}
          disabled={disabled}
        >
          {buttonContent}
        </button>
      </div>
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        error={paymentError}
      />
      {invoiceData && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setInvoiceData(null);
          }}
          paymentRequest={invoiceData.paymentRequest}
          paymentHash={invoiceData.paymentHash}
        />
      )}
    </>
  );
}