import React from 'react';
import { Camera, FileText, MapPin, Sparkles, ArrowRight, Map } from 'lucide-react';

interface HeroProps {
    onStart: () => void;
    onHistory: () => void;
    onPlans: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStart, onHistory, onPlans }) => {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(now);
    const timeLabel = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(now);

    return (
        <section className="hero card">
            <div>
                <p className="hero__eyebrow">Rapports instantanes</p>
                <h1 className="hero__title">Photo, analyse, PDF officiel en quelques minutes.</h1>
                <p className="hero__copy">
                    SiteFlow Pro automatise les rapports de chantier. Capturez une photo sur site,
                    laissez l&apos;IA enrichir les metadonnees et obtenez un PDF propre, pret a signer.
                </p>

                <div className="hero__actions">
                    <button className="btn btn--primary" onClick={onStart}>
                        <Map size={18} />
                        Choisir un chantier
                        <ArrowRight size={18} />
                    </button>
                    <button className="btn btn--ghost" onClick={onHistory}>
                        Voir l'historique
                    </button>
                    <button className="btn btn--ghost" onClick={onPlans}>
                        Gérer les plans
                    </button>
                    <span className="hero__assist">
                        <span className="hero__assist-dot" />
                        Un plan = un rapport
                    </span>
                </div>

                <div className="hero__pipeline">
                    <div className="pipeline-step">
                        <div className="pipeline-step__icon">
                            <Camera size={18} />
                        </div>
                        <div>
                            <p className="pipeline-step__title">Capture rapide</p>
                            <p className="pipeline-step__meta">Photo terrain en 1 geste</p>
                        </div>
                    </div>
                    <div className="pipeline-step">
                        <div className="pipeline-step__icon">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <p className="pipeline-step__title">Analyse intelligente</p>
                            <p className="pipeline-step__meta">Description automatique</p>
                        </div>
                    </div>
                    <div className="pipeline-step">
                        <div className="pipeline-step__icon">
                            <FileText size={18} />
                        </div>
                        <div>
                            <p className="pipeline-step__title">PDF pro</p>
                            <p className="pipeline-step__meta">Mise en page immediate</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="hero__preview">
                <div className="report-preview">
                    <div className="report-preview__header">
                        <div>
                            <p className="report-preview__title">Rapport terrain #024</p>
                            <p className="report-preview__date">
                                {dateLabel} · {timeLabel}
                            </p>
                        </div>
                        <div className="report-preview__badge">PDF</div>
                    </div>
                    <div className="report-preview__image">
                        <span>
                            <MapPin size={16} />
                            Zone B - Structure principale
                        </span>
                    </div>
                    <div className="report-preview__meta">
                        <div className="report-preview__row">
                            <span>Horodatage</span>
                            <strong>{timeLabel}</strong>
                        </div>
                        <div className="report-preview__row">
                            <span>Localisation</span>
                            <strong>GPS precis</strong>
                        </div>
                        <div className="report-preview__row">
                            <span>Validation</span>
                            <strong>Chef de chantier</strong>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
