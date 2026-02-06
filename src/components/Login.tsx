import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (!emailFromUrl) return;
    setEmail((current) => current || emailFromUrl);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="view view--centered">
      <div className="auth-container" style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        {/* Logo */}
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
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>SiteFlow Pro</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Connectez-vous à votre compte</p>
        </div>

        {/* Form */}
        <div className="card">
          {error && (
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
              {error}
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

            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                <Lock size={14} />
                Mot de passe
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

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn--primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {isLoading ? (
                'Connexion...'
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Pas encore de compte ?{' '}
              <button
                onClick={onSwitchToRegister}
                style={{ color: 'var(--color-primary)', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Créer un compte
              </button>
            </p>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          <div>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🔒</div>
            Données sécurisées
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>☁️</div>
            Sauvegarde cloud
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📱</div>
            Accès multi-appareils
          </div>
        </div>

      </div>
    </div>
  );
};
