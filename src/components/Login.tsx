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
    <div className="view view--centered auth-shell">
      <div className="auth-container auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <img
              src="/logo.png"
              alt="SiteFlow Pro"
              className="auth-logo__img"
            />
          </div>
          <h1 className="auth-title">SiteFlow Pro</h1>
          <p className="auth-subtitle">Connectez-vous a votre compte pour reprendre vos chantiers.</p>
        </div>

        <div className="card">
          {error && (
            <div className="auth-alert auth-alert--error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label className="auth-label">
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
              <label className="auth-label">
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
              <div className="auth-forgot-wrap">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="auth-link-btn"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn--primary"
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

          <div className="auth-switch">
            <p>
              Pas encore de compte ?{' '}
              <button
                onClick={onSwitchToRegister}
                className="auth-link-btn"
              >
                Créer un compte
              </button>
            </p>
          </div>
        </div>

        <div className="auth-features">
          <div>
            <div className="auth-features__emoji">🔒</div>
            Données sécurisées
          </div>
          <div>
            <div className="auth-features__emoji">☁️</div>
            Sauvegarde cloud
          </div>
          <div>
            <div className="auth-features__emoji">📱</div>
            Accès multi-appareils
          </div>
        </div>

      </div>
    </div>
  );
};
