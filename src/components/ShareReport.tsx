import React, { useMemo, useState } from 'react';
import { Share2, MessageCircle, Mail, Link2, Check, Copy, QrCode, X, Smartphone } from 'lucide-react';
import { generateShareId, createShareLink, generateShareMessage, generateQRCode, shareViaWhatsApp, shareViaEmail } from '../services/share';

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

    const shareId = useMemo(() => generateShareId(), []);
    const shareLink = useMemo(() => createShareLink(shareId), [shareId]);
    const message = useMemo(
        () => generateShareMessage(reportId, shareLink, siteName),
        [reportId, shareLink, siteName]
    );

    const legacyCopy = (text: string): boolean => {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        document.body.appendChild(input);
        input.focus();
        input.select();

        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch {
            copied = false;
        }

        document.body.removeChild(input);
        return copied;
    };

    const handleCopyLink = async () => {
        let copiedOk = false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareLink);
                copiedOk = true;
            }
        } catch {
            copiedOk = false;
        }

        if (!copiedOk) {
            copiedOk = legacyCopy(shareLink);
        }

        if (!copiedOk) return;
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
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
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
            <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h3><Share2 size={18} /> Partager le rapport</h3>
                    <button type="button" className="btn btn--ghost" onClick={onClose}>
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
                                    <small className="detail-sub">Format: 06 12 34 56 78</small>
                                </div>
                                
                                <div className="share-preview">
                                    <label>Aperçu du message</label>
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
                                    <label>Lien de partage (valable 7 jours)</label>
                                    <div className="link-copy">
                                        <input
                                            type="text"
                                            className="input"
                                            value={shareLink}
                                            readOnly
                                        />
                                        <button
                                            type="button"
                                            className="btn btn--primary"
                                            onClick={() => { void handleCopyLink(); }}
                                        >
                                            {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="share-info">
                                    <p className="detail-sub">
                                        <strong>Accusé de réception:</strong> Vous serez notifié quand le destinataire ouvre le lien.
                                    </p>
                                    <p className="detail-sub">
                                        <strong>Expiration:</strong> Ce lien expire le {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}.
                                    </p>
                                </div>

                                {typeof navigator.share === 'function' && (
                                    <button type="button" className="btn btn--ghost" onClick={handleNativeShare}>
                                        <Smartphone size={16} /> Partager natif (mobile)
                                    </button>
                                )}
                            </div>
                        )}

                        {method === 'qr' && (
                            <div className="share-section share-section--center">
                                <p className="detail-sub" style={{ marginBottom: '20px' }}>
                                    Scannez ce QR code pour accéder au rapport
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
                    <button type="button" className="btn btn--ghost" onClick={onClose}>Fermer</button>
                </div>
            </div>
        </div>
    );
};
