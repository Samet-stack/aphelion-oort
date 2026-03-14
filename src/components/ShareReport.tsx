import React, { useEffect, useMemo, useState } from 'react';
import { Share2, MessageCircle, Mail, Link2, Check, Copy, QrCode, X, Smartphone } from 'lucide-react';
import { createShareLink, generateShareMessage, generateQRCode, shareViaWhatsApp, shareViaEmail } from '../services/share';

interface ShareReportProps {
    reportId: string;
    siteName?: string;
    onClose: () => void;
}

type ShareMethod = 'whatsapp' | 'email' | 'link' | 'qr';

export const ShareReportModal: React.FC<ShareReportProps> = ({ reportId, siteName, onClose }) => {
    const [method, setMethod] = useState<ShareMethod>('whatsapp');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [copied, setCopied] = useState(false);
    const [sent, setSent] = useState(false);

    const shareLink = useMemo(() => createShareLink(reportId), [reportId]);
    const message = useMemo(() => generateShareMessage(reportId, shareLink, siteName), [reportId, shareLink, siteName]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        if (!phone.trim()) return;
        shareViaWhatsApp(phone, message);
        setSent(true);
        setTimeout(() => setSent(false), 3000);
    };

    const handleEmail = () => {
        if (!email.trim()) return;
        const subject = `Rapport de chantier - ${siteName || reportId}`;
        shareViaEmail(email, subject, message);
        setSent(true);
        setTimeout(() => setSent(false), 3000);
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Rapport de chantier - ${siteName || reportId}`,
                    text: message,
                    url: shareLink
                });
            } catch (err) {
                // User cancelled
            }
        }
    };

    const methods: { id: ShareMethod; label: string; icon: typeof MessageCircle }[] = [
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        { id: 'email', label: 'Email', icon: Mail },
        { id: 'link', label: 'Lien', icon: Link2 },
        { id: 'qr', label: 'QR Code', icon: QrCode },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Partager le rapport">
                <div className="modal__header">
                            <h3><Share2 size={18} /> Partager le rapport</h3>
                            <button className="btn btn--ghost" onClick={onClose} aria-label="Fermer la fenetre de partage">
                                <X size={18} />
                            </button>
                        </div>

                <div className="modal__body">
                    {/* Méthodes de partage */}
                    <div className="share-methods">
                        {methods.map((m) => (
                            <button
                                key={m.id}
                                className={`share-method ${method === m.id ? 'share-method--active' : ''}`}
                                onClick={() => setMethod(m.id)}
                            >
                                <m.icon size={20} />
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Contenu selon méthode */}
                    <div className="share-content">
                        {method === 'whatsapp' && (
                            <div className="share-section">
                                <div className="form-field">
                                    <label>Numéro WhatsApp</label>
                                    <div className="phone-input">
                                        <span className="phone-prefix">+33</span>
                                        <input
                                            type="tel"
                                            className="input"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                            placeholder="6 12 34 56 78"
                                            maxLength={10}
                                        />
                                    </div>
                                    <small className="detail-sub">Entrez un numero complet pour ouvrir WhatsApp.</small>
                                </div>
                                
                                <div className="share-preview">
                                    <label>Message envoye</label>
                                    <pre className="share-message">{message}</pre>
                                </div>

                                <button 
                                    className="btn btn--primary btn--whatsapp"
                                    onClick={handleWhatsApp}
                                    disabled={phone.length < 10}
                                >
                                    <MessageCircle size={18} />
                                    {sent ? 'Ouverture...' : 'Ouvrir WhatsApp'}
                                </button>
                            </div>
                        )}

                        {method === 'email' && (
                            <div className="share-section">
                                <div className="form-field">
                                    <label>Adresse email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="client@exemple.com"
                                    />
                                </div>
                                
                                <div className="share-preview">
                                    <label>Objet: Rapport de chantier - {siteName || reportId}</label>
                                    <pre className="share-message">{message}</pre>
                                </div>

                                <button 
                                    className="btn btn--primary"
                                    onClick={handleEmail}
                                    disabled={!email.includes('@')}
                                >
                                    <Mail size={18} />
                                    {sent ? 'Ouverture...' : 'Ouvrir le client mail'}
                                </button>
                            </div>
                        )}

                        {method === 'link' && (
                            <div className="share-section">
                                <div className="form-field">
                                    <label>Lien vers l'application</label>
                                    <div className="link-copy">
                                        <input
                                            type="text"
                                            className="input"
                                            value={shareLink}
                                            readOnly
                                        />
                                        <button 
                                            className="btn btn--primary"
                                            onClick={handleCopyLink}
                                        >
                                            {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="share-info">
                                    <p className="detail-sub">
                                        Ce lien ouvre l'application sur l'historique. Le destinataire doit deja avoir un acces.
                                    </p>
                                </div>

                                {typeof navigator.share === 'function' && (
                                    <button className="btn btn--ghost" onClick={handleNativeShare}>
                                        <Smartphone size={16} /> Partager natif (mobile)
                                    </button>
                                )}
                            </div>
                        )}

                        {method === 'qr' && (
                            <div className="share-section share-section--center">
                                <p className="detail-sub" style={{ marginBottom: '20px' }}>
                                    Scannez ce QR code pour ouvrir l'application
                                </p>
                                <div className="qr-code">
                                    <img 
                                        src={generateQRCode(shareLink, 250)} 
                                        alt="QR Code"
                                        className="qr-code__img"
                                    />
                                </div>
                                <p className="detail-sub" style={{ marginTop: '16px' }}>
                                    Rapport: <strong>{reportId}</strong>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal__footer">
                        <button className="btn btn--ghost" onClick={onClose}>Fermer</button>
                    </div>
                </div>
            </div>
    );
};
