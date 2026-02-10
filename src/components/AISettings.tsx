import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { isAIConfigured } from '../services/gemini';

export const AISettings: React.FC = () => {
    const [configured, setConfigured] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkConfig = async () => {
            try {
                const isConfigured = await isAIConfigured();
                setConfigured(isConfigured);
            } catch {
                setConfigured(false);
            } finally {
                setLoading(false);
            }
        };
        checkConfig();
    }, []);

    if (loading) {
        return (
            <div className="card" style={{ maxWidth: '600px', textAlign: 'center', padding: '40px' }}>
                <Loader2 size={32} className="spin" />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
                    Vérification de la configuration...
                </p>
            </div>
        );
    }

    return (
        <div className="card" style={{ maxWidth: '600px' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: configured 
                        ? 'rgba(124, 252, 138, 0.2)' 
                        : 'rgba(255, 183, 3, 0.2)',
                    display: 'grid',
                    placeItems: 'center',
                }}>
                    <Sparkles 
                        size={24} 
                        style={{ color: configured ? 'var(--success)' : 'var(--primary)' }} 
                    />
                </div>
                <div>
                    <h3 style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 700,
                        marginBottom: '4px',
                    }}>
                        Analyse IA
                    </h3>
                    <p style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-muted)',
                        margin: 0,
                    }}>
                        {configured 
                            ? 'Google Gemini active' 
                            : 'Non configurée'}
                    </p>
                </div>
            </div>

            <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: configured 
                    ? 'rgba(124, 252, 138, 0.1)' 
                    : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${configured 
                    ? 'rgba(124, 252, 138, 0.3)' 
                    : 'rgba(239, 68, 68, 0.3)'}`,
                marginBottom: '20px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: configured ? 0 : '12px',
                }}>
                    {configured ? (
                        <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                        <AlertCircle size={20} style={{ color: 'var(--danger)' }} />
                    )}
                    <span style={{
                        fontWeight: 600,
                        color: configured ? 'var(--success)' : 'var(--danger)',
                    }}>
                        {configured 
                            ? 'Google Gemini est active' 
                            : 'Google Gemini n\'est pas configurée'}
                    </span>
                </div>
                
                {!configured && (
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        margin: 0,
                        marginLeft: '30px',
                    }}>
                        Ajoutez votre clé API OpenAI dans le fichier <code>.env</code> pour activer l'analyse automatique des photos.
                    </p>
                )}
            </div>

            <div style={{
                display: 'grid',
                gap: '12px',
            }}>
                <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginBottom: '4px',
                }}>
                    Fonctionnalités activées
                </h4>
                
                {[
                    'Analyse automatique des photos de chantier',
                    'Détection des problèmes de sécurité',
                    'Catégorisation intelligente des rapports',
                    'Évaluation de la priorité',
                    'Tags automatiques (EPI, matériaux, etc.)',
                ].map((feature, index) => (
                    <div 
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            background: 'rgba(15, 23, 42, 0.5)',
                            borderRadius: '8px',
                            opacity: configured ? 1 : 0.5,
                        }}
                    >
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: configured 
                                ? 'var(--success)' 
                                : 'var(--text-muted)',
                            display: 'grid',
                            placeItems: 'center',
                        }}>
                            <CheckCircle2 size={12} color="#000" />
                        </div>
                        <span style={{
                            fontSize: '0.85rem',
                        }}>
                            {feature}
                        </span>
                    </div>
                ))}
            </div>

            {!configured && (
                <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'rgba(66, 133, 244, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(66, 133, 244, 0.2)',
                }}>
                    <p style={{
                        fontSize: '0.85rem',
                        marginBottom: '12px',
                        color: 'var(--text-main)',
                    }}>
                        <strong>Comment configurer Google Gemini ?</strong>
                    </p>
                    <ol style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        paddingLeft: '20px',
                        margin: 0,
                        lineHeight: 1.8,
                    }}>
                        <li>Créez un compte Google sur <a 
                            href="https://aistudio.google.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#4285F4' }}
                        >aistudio.google.com</a></li>
                        <li>Allez dans <strong>Get API Key</strong></li>
                        <li>Créez un fichier <code>.env</code> à la racine du projet</li>
                        <li>Ajoutez : <code>VITE_GEMINI_API_KEY=votre-clé</code></li>
                        <li>Redémarrez l'application avec <code>npm run dev</code></li>
                    </ol>
                    
                    <a 
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--primary"
                        style={{
                            marginTop: '16px',
                            width: '100%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: '#4285F4',
                        }}
                    >
                        <ExternalLink size={16} />
                        Obtenir une clé API Google
                    </a>
                </div>
            )}

            {configured && (
                <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    background: 'rgba(66, 133, 244, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(66, 133, 244, 0.2)',
                }}>
                    <strong style={{ color: '#4285F4' }}>
                        🤖 Modèle utilisé :
                    </strong>{' '}
                    Gemini 2.0 Flash
                    <br />
                    <strong style={{ color: '#4285F4' }}>
                        💰 Coût :
                    </strong>{' '}
                    Gratuit (avec quotas généreux)
                    <br />
                    <strong style={{ color: '#4285F4' }}>
                        ⚡ Avantages :
                    </strong>{' '}
                    Rapide, multilingue, compréhension avancée des images
                </div>
            )}
        </div>
    );
};

export default AISettings;
