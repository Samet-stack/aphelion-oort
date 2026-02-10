import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    onClose: (id: string) => void;
    duration?: number;
}

// We use inline styles for now to match the project's current state, 
// but leverage the CSS variables defined in index.css
export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, duration = 4000 }) => {
    const colorVar = type === 'error' ? 'danger' : type;

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)', // Base border
                borderLeft: `4px solid var(--${colorVar})`, // Colored accent
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                minWidth: '300px',
                maxWidth: '400px',
                pointerEvents: 'auto',
                marginBottom: '10px',
                backdropFilter: 'blur(8px)',
            }}
        >
            <div style={{ color: `var(--${colorVar})` }}>
                {type === 'success' && <CheckCircle size={24} />}
                {type === 'error' && <AlertTriangle size={24} />}
                {type === 'warning' && <AlertTriangle size={24} />}
                {type === 'info' && <Info size={24} />}
            </div>

            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', flex: 1 }}>
                {message}
            </p>

            <button
                onClick={() => onClose(id)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'grid',
                    placeItems: 'center'
                }}
            >
                <X size={16} />
            </button>
        </motion.div>
    );
};
