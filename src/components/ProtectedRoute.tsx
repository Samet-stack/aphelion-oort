import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageTransition } from './PageTransition';
import { Login } from './Login';
import { Register } from './Register';
import { useState } from 'react';

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

    if (isLoading) {
        return (
            <div className="view view--centered">
                <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
                    <div className="spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        Chargement...
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Connexion au serveur et preparation de la session.
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return authMode === 'login' ? (
            <PageTransition key="login">
                <Login onSwitchToRegister={() => setAuthMode('register')} />
            </PageTransition>
        ) : (
            <PageTransition key="register">
                <Register onSwitchToLogin={() => setAuthMode('login')} />
            </PageTransition>
        );
    }

    return <Outlet />;
};
