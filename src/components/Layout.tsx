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
                role="banner"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    // Styles moved to .app__header in index.css for better performance
                }}
            >
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                        {showLogo ? (
                            <div className="relative w-full h-full rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-lg ring-1 ring-white/5">
                                <img
                                    src={branding.logoUrl}
                                    alt={branding.companyName}
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoError(true)}
                                />
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-900 font-bold font-display text-xl">
                                SF
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-display font-bold text-lg leading-tight tracking-tight text-white/90">
                            {branding.productName}
                        </span>
                        <span className="text-[0.65rem] uppercase tracking-widest font-semibold text-amber-500/80">
                            {branding.companyName}
                        </span>
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
                                aria-label="Se déconnecter du compte"
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

            <main className="app__main" role="main">
                <div className="app__surface" style={{ maxWidth: '100%', padding: 0 }}>
                    {children}
                </div>
            </main>

            <footer className="app__footer" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                {branding.productName} © 2026
            </footer>

            {isAuthenticated && <OfflineIndicator />}
        </div>
    );
};
