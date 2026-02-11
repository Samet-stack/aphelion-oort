import React, { useEffect, useId, useState } from 'react';
import { X, Share2, Users, Send, Check, AlertCircle } from 'lucide-react';
import { sharesApi } from '../services/api';
import { Button, SurfaceCard, TextField } from './ui';

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
  onShared,
}) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : 'Erreur lors du partage';
      setError(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <SurfaceCard className="modal-card">
        <div className="modal-header">
          <div className="modal-header__left">
            <div className="modal-header__icon">
              <Share2 size={20} color="#ffb703" />
            </div>
            <div>
              <h3 className="modal-header__title" id={titleId}>
                Partager le rapport
              </h3>
              <p className="modal-header__subtitle" id={descriptionId}>
                {siteName || 'Partage sécurisé vers un autre utilisateur SiteFlow'}
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            className="modal-header__close"
            variant="ghost"
            size="sm"
            aria-label="Fermer la fenêtre de partage"
          >
            <X size={20} />
          </Button>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert--success" role="status">
            <Check size={16} />
            Rapport partagé avec succès !
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid">
          <TextField
            id="share-email"
            type="email"
            label="Email du destinataire"
            placeholder="collegue@entreprise.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <div className="form-field">
            <label htmlFor="share-message">Message (optionnel)</label>
            <textarea
              id="share-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Bonjour, voici le rapport du chantier..."
              rows={3}
              className="input form-textarea"
            />
          </div>

          <div>
            <label className="form-label" id="share-permission-label">
              Permission
            </label>
            <div className="permission-selector" role="radiogroup" aria-labelledby="share-permission-label">
              <button
                type="button"
                onClick={() => setPermission('view')}
                className={`permission-btn pressable ${permission === 'view' ? 'permission-btn--active' : ''}`}
                role="radio"
                aria-checked={permission === 'view'}
              >
                <div className="permission-btn__label">
                  <Users size={18} />
                  Lecture seule
                </div>
                <div className="permission-btn__hint">Voir uniquement</div>
              </button>
              <button
                type="button"
                onClick={() => setPermission('edit')}
                className={`permission-btn pressable ${permission === 'edit' ? 'permission-btn--active' : ''}`}
                role="radio"
                aria-checked={permission === 'edit'}
              >
                <div className="permission-btn__label">
                  <Send size={18} />
                  Modification
                </div>
                <div className="permission-btn__hint">Peut modifier</div>
              </button>
            </div>
          </div>

          <Button type="submit" disabled={success} loading={isLoading} className="form-actions--full">
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
          </Button>
        </form>

        <p className="modal-footer">
          Le destinataire recevra une notification par email s'il a un compte SiteFlow.
        </p>
      </SurfaceCard>
    </div>
  );
};
