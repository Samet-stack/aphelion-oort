import React, { useState } from 'react';
import { branding } from '../config/branding';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { OfflineIndicator, OfflineStatusDot } from './OfflineIndicator';
import { motion } from 'framer-motion';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [logoError, setLogoError] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const showLogo = Boolean(branding.logoUrl) && !logoError;

    return (
        <div className="app">
            <motion.header
                className="app__header"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    // Styles moved to .app__header in index.css for better performance
                }}
            >
                <div className="brand">
                    <div className="brand__mark" style={{ background: 'var(--primary)', color: 'black' }}>
                        {showLogo ? (
                            <img
                                src={branding.logoUrl}
                                alt={`${branding.companyName} logo`}
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <span className="brand__mark-text" style={{ fontWeight: 800 }}>SF</span>
                        )}
                    </div>
                    <div className="brand__text">
                        <span className="brand__name" style={{ letterSpacing: '-0.02em' }}>{branding.productName}</span>
                        <span className="brand__tag" style={{ color: 'var(--primary)' }}>{branding.companyName}</span>
                    </div>
                </div>

                <div className="status-row">
                    {isAuthenticated && user && <OfflineStatusDot />}
                    {isAuthenticated && user ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="status-user" title={user.email}>
                                <User size={20} color="var(--primary)" />
                                <span className="status-user__name">{user.firstName || user.email}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="btn btn--ghost btn--danger btn--sm btn--pill"
                                style={{ border: '1px solid var(--border-light)' }}
                            >
                                <LogOut size={16} />
                                <span>Déconnexion</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="status-pill status-pill--success">Mode démo</span>
                            <span className="status-pill status-pill--info">Connexion requise</span>
                        </>
                    )}
                </div>
            </motion.header>

            <main className="app__main">
                <div className="app__surface" style={{ maxWidth: '100%', padding: 0 }}>
                    {children}
                </div>
            </main>

            <footer className="app__footer" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                {branding.productName} © 2026
                {isAuthenticated && user?.companyName && (
                    <span className="ml-2">• {user.companyName}</span>
                )}
            </footer>

            {isAuthenticated && <OfflineIndicator />}
        </div>
    );
};
