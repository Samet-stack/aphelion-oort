import React from 'react';
import { Camera, FileText, Sparkles, ArrowRight, Map, Clock3, ShieldCheck, Cloud, Activity, ClipboardList, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Hero: React.FC = () => {
    const navigate = useNavigate();
    const { stats, reports, offlineState } = useAuth();

    const recentReports = reports.slice(0, 4);

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
        <div className="home-layout">
            <motion.section
                className="hero card"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="hero__content">
                    <motion.p variants={itemVariants} className="hero__eyebrow" style={{ color: 'var(--primary)' }}>
                        Rapports chantier simples
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="hero__title">
                        Créez des rapports chantier
                        <br />clairs, rapides et partageables.
                    </motion.h1>
                    <motion.p variants={itemVariants} className="hero__copy">
                        Choisissez un chantier, ajoutez une photo, completez les infos utiles,
                        puis telechargez un PDF clair pour votre client ou votre equipe.
                    </motion.p>

                    <motion.div variants={itemVariants} className="hero__actions">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--primary"
                            onClick={() => navigate('/select-plan')}
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
                            onClick={() => navigate('/history')}
                        >
                            Voir mes rapports
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--ghost"
                            onClick={() => navigate('/plans')}
                        >
                            Gérer les plans
                        </motion.button>
                    </motion.div>

                    <motion.div variants={itemVariants} className="hero__pipeline">
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon">
                                <Camera size={18} color="var(--primary)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">Capture rapide</p>
                                <p className="pipeline-step__meta">Photo ou PDF en quelques secondes</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon">
                                <Sparkles size={18} color="var(--info)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">Analyse intelligente</p>
                                <p className="pipeline-step__meta">Texte de base et localisation pre-remplis</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <div className="pipeline-step__icon">
                                <FileText size={18} color="var(--success)" />
                            </div>
                            <div>
                                <p className="pipeline-step__title">PDF pro</p>
                                <p className="pipeline-step__meta">Export simple a partager</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <motion.aside variants={itemVariants} className="hero__preview">
                    <div className="hero-metric-grid">
                        <div className="hero-metric-card">
                            <span className="hero-metric-card__label">
                                <Clock3 size={14} /> Duree moyenne
                            </span>
                            <strong>4 min / rapport</strong>
                        </div>
                        <div className="hero-metric-card">
                            <span className="hero-metric-card__label">
                                <Cloud size={14} /> Synchronisation
                            </span>
                            <strong>Cloud + hors-ligne</strong>
                        </div>
                        <div className="hero-metric-card">
                            <span className="hero-metric-card__label">
                                <ShieldCheck size={14} /> Tracabilite
                            </span>
                            <strong>Integrite du rapport incluse</strong>
                        </div>
                    </div>
                    <div className="hero-note">
                        <p className="hero-note__title">Conseil du jour</p>
                        <p className="hero-note__text">
                            Ajoutez le nom du client et de l'operateur avant export pour un PDF plus clair.
                        </p>
                    </div>
                </motion.aside>
            </motion.section>

            <motion.section
                className="home-panels"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
            >
                <article className="card home-panel">
                    <div className="home-panel__header">
                        <h3>
                            <Activity size={16} />
                            Vue d'ensemble
                        </h3>
                    </div>
                    <div className="home-stats-grid">
                        <div className="home-stat-tile">
                            <span className="home-stat-tile__label">Rapports totaux</span>
                            <strong>{stats.totalReports}</strong>
                        </div>
                        <div className="home-stat-tile">
                            <span className="home-stat-tile__label">Travaux supp.</span>
                            <strong>{stats.totalExtraWorks}</strong>
                        </div>
                        <div className="home-stat-tile">
                            <span className="home-stat-tile__label">Valeur TS</span>
                            <strong>{stats.totalExtraValue.toLocaleString('fr-FR')}€</strong>
                        </div>
                        <div className="home-stat-tile">
                            <span className="home-stat-tile__label">En attente sync</span>
                            <strong>{offlineState.pendingCount}</strong>
                        </div>
                    </div>
                </article>

                <article className="card home-panel">
                    <div className="home-panel__header">
                        <h3>
                            <ClipboardList size={16} />
                            Derniers rapports
                        </h3>
                        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/history')}>
                            Voir tout
                        </button>
                    </div>
                    {recentReports.length === 0 ? (
                        <div className="home-empty">
                            <AlertTriangle size={18} />
                            Aucun rapport pour le moment.
                        </div>
                    ) : (
                        <div className="home-recent-list">
                            {recentReports.map((report) => (
                                <button
                                    type="button"
                                    key={report.id}
                                    className="home-recent-item"
                                    onClick={() => navigate('/history')}
                                >
                                    <div>
                                        <p className="home-recent-item__title">{report.siteName || report.reportId}</p>
                                        <p className="home-recent-item__meta">{report.dateLabel}</p>
                                    </div>
                                    <span className="badge badge--info">{report.id.startsWith('local-') ? 'Local' : 'Cloud'}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </article>
            </motion.section>
        </div>
    );
};
