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
    <div className="modal-overlay">
      <div className="card modal-card">
        <div className="modal-header">
          <div className="modal-header__left">
            <div className="modal-header__icon">
              <Share2 size={20} color="#ffb703" />
            </div>
            <div>
              <h3 className="modal-header__title">Partager le rapport</h3>
              {siteName && (
                <p className="modal-header__subtitle">{siteName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="link-btn modal-header__close"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert alert--error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert--success">
            <Check size={16} />
            Rapport partagé avec succès !
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <label className="form-label">
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
            <label className="form-label">
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour, voici le rapport du chantier..."
              rows={3}
              className="input form-textarea"
            />
          </div>

          <div>
            <label className="form-label">
              Permission
            </label>
            <div className="permission-selector">
              <button
                type="button"
                onClick={() => setPermission('view')}
                className={`permission-btn ${permission === 'view' ? 'permission-btn--active' : ''}`}
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
                className={`permission-btn ${permission === 'edit' ? 'permission-btn--active' : ''}`}
              >
                <div className="permission-btn__label">
                  <Send size={18} />
                  Modification
                </div>
                <div className="permission-btn__hint">Peut modifier</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="btn btn--primary form-actions--full"
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

        <p className="modal-footer">
          Le destinataire recevra une notification par email s'il a un compte SiteFlow.
        </p>
      </div>
    </div>
  );
};
