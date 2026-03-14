import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, ArrowRight, AlertCircle, Briefcase } from 'lucide-react';
import { branding } from '../config/branding';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName
      });
      navigate(`/register-success?email=${encodeURIComponent(formData.email)}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription');
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
              src={branding.logoUrl}
              alt={branding.productName}
              className="auth-logo__img"
            />
          </div>
          <h1 className="auth-title">Creer un compte</h1>
          <p className="auth-subtitle">Invitez votre equipe et centralisez vos rapports terrain.</p>
        </div>

        <div className="card">
          {error && (
            <div className="auth-alert auth-alert--error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-grid-two">
              <div className="form-field">
                <label className="auth-label">
                  <User size={14} />
                  Prénom
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input"
                  placeholder="Jean"
                />
              </div>

              <div className="form-field">
                <label className="auth-label">
                  <User size={14} />
                  Nom
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input"
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="auth-label">
                <Briefcase size={14} />
                Entreprise
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="input"
                placeholder="Votre entreprise"
              />
            </div>

            <div className="form-field">
              <label className="auth-label">
                <Mail size={14} />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
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
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <p className="auth-field-help">Minimum 6 caractères</p>
            </div>

            <div className="form-field">
              <label className="auth-label">
                <Lock size={14} />
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn--primary"
            >
              {isLoading ? (
                'Inscription...'
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              Déjà un compte ?{' '}
              <button
                onClick={onSwitchToLogin}
                className="auth-link-btn"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>

        <div className="auth-footer-note">
          <p>
            En créant un compte, vous acceptez nos conditions d'utilisation.
            <br />
            Vos données sont chiffrées et sécurisées.
          </p>
        </div>
      </div>
    </div>
  );
};
