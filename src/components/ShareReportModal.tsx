import React, { useState } from 'react';
import { X, Share2, Users, Send, Check, AlertCircle } from 'lucide-react';
import { sharesApi } from '../services/api';

interface ShareReportModalProps {
  reportId: string;
  siteName?: string;
  onClose: () => void;
  onShared?: () => void;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  reportId,
  siteName,
  onClose,
  onShared
}) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email || !email.includes('@')) {
      setError('Veuillez entrer un email valide');
      return;
    }

    setIsLoading(true);

    try {
      await sharesApi.shareReport(reportId, email, message, permission);
      setSuccess(true);
      setEmail('');
      setMessage('');
      onShared?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du partage');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '28rem', padding: '1.5rem', borderRadius: '1rem', background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255, 183, 3, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Share2 size={20} color="#ffb703" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Partager le rapport</h3>
              {siteName && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{siteName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="link-btn"
            style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <Check size={16} />
            Rapport partagé avec succès !
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Email du destinataire
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collegue@entreprise.com"
              className="input"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour, voici le rapport du chantier..."
              rows={3}
              className="input"
              style={{ padding: '0.75rem', resize: 'none', height: 'auto' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Permission
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setPermission('view')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: permission === 'view' ? '1px solid #ffb703' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: permission === 'view' ? 'rgba(255, 183, 3, 0.1)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  <Users size={18} />
                  Lecture seule
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Voir uniquement</div>
              </button>
              <button
                type="button"
                onClick={() => setPermission('edit')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: permission === 'edit' ? '1px solid #ffb703' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: permission === 'edit' ? 'rgba(255, 183, 3, 0.1)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                  <Send size={18} />
                  Modification
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Peut modifier</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="btn btn--primary"
            style={{ width: '100%' }}
          >
            {isLoading ? (
              'Partage en cours...'
            ) : success ? (
              <>
                <Check size={18} />
                Partagé !
              </>
            ) : (
              <>
                <Share2 size={18} />
                Partager le rapport
              </>
            )}
          </button>
        </form>

        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          Le destinataire recevra une notification par email s'il a un compte SiteFlow.
        </p>
      </div>
    </div>
  );
};
