import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../services/api';

export const ForgotPassword = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
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
                        Mot de passe oublié
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                        Entrez votre adresse email pour recevoir un lien de réinitialisation.
                    </p>
                </div>

                <div className="card">
                    {status === 'success' ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{ color: '#10b981', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Email envoyé</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                                {message}
                            </p>
                            <button
                                onClick={() => navigate('/', { replace: true })}
                                className="btn btn--outline"
                                style={{ width: '100%' }}
                            >
                                Retour à la connexion
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
                                        <Mail size={14} />
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input"
                                        placeholder="votre@email.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    className="btn btn--primary"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                >
                                    {status === 'loading' ? (
                                        'Envoi en cours...'
                                    ) : (
                                        <>
                                            Envoyer le lien
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                                <button
                                    onClick={() => navigate('/', { replace: true })}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '0.875rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <ArrowLeft size={14} />
                                    Retour à la connexion
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
