import React, { useEffect, useRef, useState } from 'react';
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
    const headerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        const updateHeaderHeight = () => {
            document.documentElement.style.setProperty('--header-height', `${Math.round(header.offsetHeight)}px`);
        };

        updateHeaderHeight();
        window.addEventListener('resize', updateHeaderHeight, { passive: true });

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(updateHeaderHeight);
            observer.observe(header);
        }

        return () => {
            window.removeEventListener('resize', updateHeaderHeight);
            observer?.disconnect();
        };
    }, []);

    return (
        <div className="app">
            <motion.header
                ref={headerRef}
                className="app__header"
                role="banner"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                    // Styles moved to .app__header in index.css for better performance
                }}
            >
                <div className="app-brand">
                    <div className="app-brand__logo-wrap">
                        {showLogo ? (
                            <div className="app-brand__logo-shell">
                                <img
                                    src={branding.logoUrl}
                                    alt={branding.companyName}
                                    className="app-brand__logo-img"
                                    onError={() => setLogoError(true)}
                                />
                                <div className="app-brand__logo-glow" />
                            </div>
                        ) : (
                            <div className="app-brand__logo-fallback">
                                SF
                            </div>
                        )}
                    </div>
                    <div className="app-brand__text">
                        <span className="app-brand__name">
                            {branding.productName}
                        </span>
                        <span className="app-brand__company">
                            {branding.companyName}
                        </span>
                    </div>
                </div>

                <div className="status-row">
                    {isAuthenticated && user && <OfflineStatusDot />}
                    {isAuthenticated && user ? (
                        <div className="status-auth">
                            <div className="status-user" title={user.email}>
                                <User size={20} color="var(--primary)" />
                                <span className="status-user__name">{user.firstName || user.email}</span>
                            </div>
                            <button
                                onClick={logout}
                                className="btn btn--ghost btn--danger btn--sm btn--pill"
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
                <div className="app__surface">
                    {children}
                </div>
            </main>

            <footer className="app__footer">
                {branding.productName} © 2026
            </footer>

            {isAuthenticated && <OfflineIndicator />}
        </div>
    );
};
