import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, ArrowRight, AlertCircle, Briefcase } from 'lucide-react';

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
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Créez votre compte professionnel</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>Minimum 6 caractères</p>
            </div>

            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
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
              style={{ width: '100%', marginTop: '0.5rem' }}
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

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Déjà un compte ?{' '}
              <button
                onClick={onSwitchToLogin}
                style={{ color: 'var(--color-primary)', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>

        {/* Info */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
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
