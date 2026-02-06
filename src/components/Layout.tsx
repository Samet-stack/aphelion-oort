import React, { useState } from 'react';
import { branding } from '../config/branding';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';
import { OfflineIndicator, OfflineStatusDot } from './OfflineIndicator';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [logoError, setLogoError] = useState(false);
    const { isAuthenticated, user, logout } = useAuth();
    const showLogo = Boolean(branding.logoUrl) && !logoError;

    return (
        <div className="app">
            <header className="app__header">
                <div className="brand">
                    <div className="brand__mark">
                        {showLogo ? (
                            <img
                                src={branding.logoUrl}
                                alt={`${branding.companyName} logo`}
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <span className="brand__mark-text">SF</span>
                        )}
                    </div>
                    <div className="brand__text">
                        <span className="brand__name">{branding.productName}</span>
                        <span className="brand__tag">{branding.companyName}</span>
                    </div>
                </div>
                
                <div className="status-row">
                    {isAuthenticated && user && <OfflineStatusDot />}
                    {isAuthenticated && user ? (
                        <>
                            <div className="status-user" title={user.email}>
                                <User size={14} />
                                <span className="status-user__name">{user.firstName || user.email}</span>
                            </div>
                            <button 
                                onClick={logout}
                                className="btn btn--ghost btn--danger btn--sm btn--pill"
                            >
                                <LogOut size={16} />
                                <span>Déconnexion</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="status-pill status-pill--success">Mode démo</span>
                            <span className="status-pill status-pill--info">Connexion requise</span>
                        </>
                    )}
                </div>
            </header>

            <main className="app__main">
                <div className="app__surface">{children}</div>
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
