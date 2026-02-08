import React from 'react';
import { Camera, FileText, MapPin, Sparkles, ArrowRight, Map, ShieldCheck, Cloud, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroProps {
    onStart: () => void;
    onHistory: () => void;
    onPlans: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStart, onHistory, onPlans }) => {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(now);
    const timeLabel = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(now);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.section
            className="hero card"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{
                background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-page) 100%)',
                border: '1px solid var(--border-light)'
            }}
        >
            <div className="hero__main">
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <motion.p variants={itemVariants} className="hero__eyebrow" style={{ color: 'var(--primary)' }}>
                        Rapports instantanés
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="hero__title">
                        Photo, analyse, PDF officiel<br />en quelques minutes.
                    </motion.h1>
                    <motion.p variants={itemVariants} className="hero__copy" style={{ maxWidth: '600px' }}>
                        SiteFlow Pro automatise les rapports de chantier. Capturez une photo sur site,
                        laissez l'IA enrichir les métadonnées et obtenez un PDF propre, prêt à signer.
                    </motion.p>

                    <motion.div variants={itemVariants} className="hero__actions">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--primary"
                            onClick={onStart}
                            style={{ boxShadow: '0 4px 20px var(--primary-glow)' }}
                        >
                            <Map size={18} />
                            Choisir un chantier
                            <ArrowRight size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--ghost"
                            onClick={onHistory}
                        >
                            Voir l'historique
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--ghost"
                            onClick={onPlans}
                        >
                            Gérer les plans
                        </motion.button>
                    </motion.div>

                    <motion.div variants={itemVariants} className="hero__pipeline">
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon" style={{ background: 'var(--bg-surface-hover)' }}>
                                <Camera size={18} color="var(--primary)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">Capture rapide</p>
                                <p className="pipeline-step__meta">Photo terrain en 1 geste</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon" style={{ background: 'var(--bg-surface-hover)' }}>
                                <Sparkles size={18} color="var(--info)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">Analyse intelligente</p>
                                <p className="pipeline-step__meta">Description automatique</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon" style={{ background: 'var(--bg-surface-hover)' }}>
                                <FileText size={18} color="var(--success)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">PDF pro</p>
                                <p className="pipeline-step__meta">Mise en page immédiate</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <motion.div variants={itemVariants} className="hero__preview">
                    <div className="report-preview" style={{
                        background: 'var(--bg-surface)',
                        borderColor: 'var(--border-light)',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
                    }}>
                        <div className="report-preview__header">
                            <div>
                                <p className="report-preview__title">Rapport terrain #024</p>
                                <p className="report-preview__date">
                                    {dateLabel} · {timeLabel}
                                </p>
                            </div>
                            <div className="report-preview__badge" style={{ background: 'var(--primary)', color: 'black' }}>PDF</div>
                        </div>
                        <div className="report-preview__image" style={{ background: 'linear-gradient(to bottom, #2a2a2a, #1a1a1a)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                                <MapPin size={16} />
                                Zone B - Structure principale
                            </span>
                        </div>
                        <div className="report-preview__meta">
                            <div className="report-preview__row">
                                <span style={{ color: 'var(--text-muted)' }}>Horodatage</span>
                                <strong>{timeLabel}</strong>
                            </div>
                            <div className="report-preview__row">
                                <span style={{ color: 'var(--text-muted)' }}>Localisation</span>
                                <strong>GPS précis</strong>
                            </div>
                            <div className="report-preview__row">
                                <span style={{ color: 'var(--text-muted)' }}>Validation</span>
                                <strong>Chef de chantier</strong>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <motion.div variants={itemVariants} className="hero__bottom">
                <div className="hero-trust">
                    <div className="hero-trust__item">
                        <div className="hero-trust__icon">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <p className="hero-trust__title">Données sécurisées</p>
                            <p className="hero-trust__meta">Traçabilité + contrôle d'accès</p>
                        </div>
                    </div>
                    <div className="hero-trust__item">
                        <div className="hero-trust__icon" style={{ color: 'var(--info)' }}>
                            <Cloud size={18} />
                        </div>
                        <div>
                            <p className="hero-trust__title">Sauvegarde cloud</p>
                            <p className="hero-trust__meta">Retrouvez tout sur tous vos appareils</p>
                        </div>
                    </div>
                    <div className="hero-trust__item">
                        <div className="hero-trust__icon" style={{ color: 'var(--success)' }}>
                            <Smartphone size={18} />
                        </div>
                        <div>
                            <p className="hero-trust__title">Terrain friendly</p>
                            <p className="hero-trust__meta">Gros boutons, clair, utilisable dehors</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.section>
    );
};
