import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export const RegisterSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="view view--centered">
      <div className="auth-container" style={{ maxWidth: '420px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}
          >
            <CheckCircle2 size={34} style={{ color: '#22c55e' }} />
          </div>

          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)'
            }}
          >
            Compte cree avec succes
          </h1>

          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
            Tu peux maintenant te connecter et acceder a l'application.
          </p>
        </div>

        <div className="card">
          {email && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                borderRadius: '12px',
                background: 'rgba(255, 183, 3, 0.08)',
                border: '1px solid rgba(255, 183, 3, 0.18)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem'
              }}
            >
              Compte: <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>
            </div>
          )}

          <button
            className="btn btn--primary"
            style={{ width: '100%' }}
            onClick={() => navigate(`/${email ? `?email=${encodeURIComponent(email)}` : ''}`, { replace: true })}
          >
            Se connecter
            <ArrowRight size={18} />
          </button>

          <button
            className="btn btn--ghost"
            style={{ width: '100%', marginTop: '0.75rem' }}
            onClick={() => navigate('/', { replace: true })}
          >
            Aller a la connexion
          </button>
        </div>
      </div>
    </div>
  );
};
