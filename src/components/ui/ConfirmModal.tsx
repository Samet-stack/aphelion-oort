import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { SurfaceCard } from './SurfaceCard';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isDestructive = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(event) => event.stopPropagation()}
          >
            <SurfaceCard className="modal-card" style={{ maxWidth: '400px', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: isDestructive ? 'var(--danger)' : 'var(--primary)',
                }}
              />

              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px',
                    color: isDestructive ? 'var(--danger)' : 'var(--text-main)',
                  }}
                >
                  {isDestructive ? <AlertTriangle size={24} aria-hidden="true" /> : null}
                  <h3 id={titleId} style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                    {title}
                  </h3>
                </div>
                <p id={descriptionId} style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  {message}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button onClick={onClose} variant="ghost" disabled={isSubmitting}>
                  {cancelLabel}
                </Button>
                <Button
                  onClick={() => {
                    void handleConfirm();
                  }}
                  variant={isDestructive ? 'danger' : 'primary'}
                  loading={isSubmitting}
                >
                  {confirmLabel}
                </Button>
              </div>

              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                aria-label="Fermer la boîte de dialogue"
                style={{ position: 'absolute', top: '20px', right: '20px' }}
              >
                <X size={20} />
              </Button>
            </SurfaceCard>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
