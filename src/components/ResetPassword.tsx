import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../services/api';

export const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Lien de réinitialisation invalide ou manquant.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setStatus('error');
            setMessage('Les mots de passe ne correspondent pas.');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setMessage('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Une erreur est survenue.');
            }

            setStatus('success');
            setMessage(data.message);
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Impossible de se connecter au serveur.');
        }
    };

    if (!token) {
        return (
            <div className="view view--centered">
                <div className="auth-container card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
                    <AlertCircle size={48} color="#f87171" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ marginBottom: '1rem' }}>Lien invalide</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                        Le lien de réinitialisation est manquant ou invalide.
                    </p>
                    <button onClick={() => navigate('/', { replace: true })} className="btn btn--primary">
                        Retour à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="view view--centered">
            <div className="auth-container" style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                    }}>
                        <img
                            src="/logo.png"
                            alt="SiteFlow Pro"
                            style={{
                                width: '80px',
                                height: '80px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 0 20px rgba(255, 183, 3, 0.3))'
                            }}
                        />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                        Nouveau mot de passe
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                        Veuillez entrer votre nouveau mot de passe.
                    </p>
                </div>

                <div className="card">
                    {status === 'success' ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{ color: '#10b981', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Réinitialisation réussie</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                                {message}
                            </p>
                            <button
                                onClick={() => navigate('/', { replace: true })}
                                className="btn btn--primary"
                                style={{ width: '100%' }}
                            >
                                Se connecter
                            </button>
                        </div>
                    ) : (
                        <>
                            {status === 'error' && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    color: '#f87171',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem'
                                }}>
                                    <AlertCircle size={16} />
                                    {message}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-field">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                        <Lock size={14} />
                                        Nouveau mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div className="form-field">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                        <Lock size={14} />
                                        Confirmer le mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="input"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="btn btn--primary"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                >
                                    {status === 'loading' ? (
                                        'Enregistrement...'
                                    ) : (
                                        <>
                                            Enregistrer
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
