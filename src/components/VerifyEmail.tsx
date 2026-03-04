import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, AlertCircle, Loader2, Mail } from 'lucide-react';
import { API_URL } from '../services/api';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Vérification en cours...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de vérification manquant.');
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`);
        const data = await response.json();
        
        if (data.success) {
          setStatus('success');
          setMessage(data.message);
          // Redirection vers login après 3s
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.message || 'Erreur de vérification.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Erreur réseau. Veuillez réessayer.');
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card text-center py-12">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#ffb703]/20 flex items-center justify-center mx-auto mb-6">
                <Loader2 size={32} className="text-[#ffb703] spin" />
              </div>
              <h2 className="text-xl font-bold mb-2">Vérification en cours...</h2>
              <p className="text-text-muted">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <Check size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-green-500">Email vérifié !</h2>
              <p className="text-text-muted mb-4">{message}</p>
              <p className="text-sm text-text-muted">Redirection vers la connexion...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-red-500">Erreur</h2>
              <p className="text-text-muted mb-6">{message}</p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="btn btn--primary"
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Composant pour renvoyer l'email de vérification
interface ResendVerificationProps {
  email: string;
  onClose: () => void;
}

export const ResendVerification: React.FC<ResendVerificationProps> = ({ email, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResend = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setMessage('Email de vérification renvoyé !');
      } else {
        setMessage(data.message || 'Erreur lors de l\'envoi.');
      }
    } catch (err) {
      setMessage('Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#ffb703]/20 flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-[#ffb703]" />
          </div>
          <h3 className="text-lg font-bold mb-2">Vérification requise</h3>
          <p className="text-text-muted mb-4">
            Votre email n'est pas encore vérifié. Veuillez cliquer sur le lien dans l'email de confirmation.
          </p>
          
          {message && (
            <div className={`p-3 rounded-lg mb-4 text-sm ${success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 btn btn--ghost"
            >
              Fermer
            </button>
            <button
              onClick={handleResend}
              disabled={isLoading || success}
              className="flex-1 btn btn--primary"
            >
              {isLoading ? 'Envoi...' : 'Renvoyer l\'email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
