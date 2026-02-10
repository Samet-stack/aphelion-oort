import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

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
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 100,
                        display: 'grid',
                        placeItems: 'center',
                        padding: '24px'
                    }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '24px',
                            padding: '32px',
                            width: '100%',
                            maxWidth: '400px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Top Accent */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: isDestructive ? 'var(--danger)' : 'var(--primary)'
                        }} />

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                                color: isDestructive ? 'var(--danger)' : 'var(--text-main)'
                            }}>
                                {isDestructive ? <AlertTriangle size={24} /> : null}
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                                    {title}
                                </h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                                {message}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={onClose}
                                className="btn btn--ghost"
                                style={{ fontSize: '0.95rem' }}
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await onConfirm();
                                    } finally {
                                        onClose();
                                    }
                                }}
                                className={`btn ${isDestructive ? 'btn--danger' : 'btn--primary'}`}
                                style={{ fontSize: '0.95rem' }}
                            >
                                {confirmLabel}
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
};
