'use client';

import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export function Modal({ isOpen, onClose, children, footer, className, size = 'medium' }: ModalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  const sizeClass = `modal-${size}`;
  const modalContent = (
    <div className="modal-bg" onClick={onClose}>
      <div 
        className={`modal ${sizeClass} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}