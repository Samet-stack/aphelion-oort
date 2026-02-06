import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
    className?: string;
}

const pageVariants = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    in: { opacity: 1, scale: 1, y: 0 },
    out: { opacity: 0, scale: 1.02, y: -10 }
};

const pageTransition = {
    type: 'tween',
    ease: 'easeOut',
    duration: 0.3
} as const;

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = '' }) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className={`page-wrapper ${className}`}
            style={{ width: '100%', height: '100%' }}
        >
            {children}
        </motion.div>
    );
};
