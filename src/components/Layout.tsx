import React, { useState } from 'react';
import { branding } from '../config/branding';
import { useAuth } from '../contexts/AuthContext';
import { Home, LogOut, User, ClipboardList, MapPinned } from 'lucide-react';
import { OfflineIndicator, OfflineStatusDot } from './OfflineIndicator';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [logoError, setLogoError] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const showLogo = Boolean(branding.logoUrl) && !logoError;
    const companyLabel = user?.companyName?.trim() || branding.companyName;

    const navItems = [
        {
            path: '/',
            label: 'Accueil',
            icon: Home,
            isActive: (pathname: string) => pathname === '/',
        },
        {
            path: '/select-plan',
            label: 'Nouveau rapport',
            icon: MapPinned,
            isActive: (pathname: string) => ['/select-plan', '/camera', '/report'].includes(pathname),
        },
        {
            path: '/history',
            label: 'Historique',
            icon: ClipboardList,
            isActive: (pathname: string) => pathname.startsWith('/history'),
        },
        {
            path: '/plans',
            label: 'Plans',
            icon: MapPinned,
            isActive: (pathname: string) => pathname.startsWith('/plans'),
        },
    ];

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
                <div className="header-left">
                    <div className="brand">
                        <div className="brand__mark" style={{ background: 'var(--primary)', color: 'black' }}>
                            {showLogo ? (
                                <img
                                    src={branding.logoUrl}
                                    alt={`${companyLabel} logo`}
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <span className="brand__mark-text" style={{ fontWeight: 800 }}>SF</span>
                            )}
                        </div>
                        <div className="brand__text">
                            <span className="brand__name" style={{ letterSpacing: '-0.02em' }}>{branding.productName}</span>
                            <span className="brand__tag" style={{ color: 'var(--primary)' }}>{companyLabel}</span>
                        </div>
                    </div>
                    {isAuthenticated && (
                        <nav className="quick-nav" aria-label="Navigation principale">
                            {navItems.map(({ path, label, icon: Icon, isActive }) => {
                                const active = isActive(location.pathname);
                                return (
                                    <button
                                        key={path}
                                        type="button"
                                        className={`quick-nav__item ${active ? 'quick-nav__item--active' : ''}`}
                                        onClick={() => navigate(path)}
                                    >
                                        <Icon size={14} />
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    )}
                </div>

                <div className="status-row">
                    {isAuthenticated && user && <OfflineStatusDot />}
                    {isAuthenticated && user ? (
                        <div className="status-row__auth">
                            <div className="status-user" title={user.email} style={{ background: 'var(--bg-surface-hover)', padding: '4px 12px', borderRadius: '20px' }}>
                                <User size={14} color="var(--primary)" />
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
                <div className="app__surface">
                    {children}
                </div>
            </main>

            <footer className="app__footer">
                {branding.productName} © 2026
                {isAuthenticated && user?.companyName && (
                    <span className="ml-2">• {user.companyName}</span>
                )}
            </footer>

            {isAuthenticated && <OfflineIndicator />}
        </div>
    );
};
