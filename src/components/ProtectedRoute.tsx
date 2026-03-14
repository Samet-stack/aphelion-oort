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
                <div className="card analysis" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem 2rem' }}>
                    <div className="analysis__icon">
                        <span className="spin" style={{ fontSize: '1.4rem' }}>⏳</span>
                    </div>
                    <h2 className="analysis__title">Ouverture de l'application</h2>
                    <p className="analysis__copy">
                        Nous verifions votre session et preparons vos donnees.
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
