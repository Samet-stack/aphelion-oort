import React, { useEffect, useMemo, useState } from 'react';
import { Camera, FileText, Sparkles, ArrowRight, Map, ShieldCheck, Cloud, Smartphone, Building2, Layers, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { sitesApi, type ApiSiteListItem } from '../services/api';
import { branding } from '../config/branding';

interface HeroProps {
    onStart: () => void;
    onHistory: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStart, onHistory }) => {
    const [sites, setSites] = useState<ApiSiteListItem[]>([]);
    const [loadingSites, setLoadingSites] = useState(true);

    useEffect(() => {
        let active = true;
        const loadSites = async () => {
            try {
                const data = await sitesApi.getAll();
                if (active) {
                    setSites(data.slice(0, 5));
                }
            } catch {
                if (active) {
                    setSites([]);
                }
            } finally {
                if (active) {
                    setLoadingSites(false);
                }
            }
        };

        loadSites();
        return () => {
            active = false;
        };
    }, []);

    const totalPlans = useMemo(
        () => sites.reduce((sum, site) => sum + (site.plansCount || 0), 0),
        [sites]
    );

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
        >
            <div className="hero__main">
                <div className="hero__content">
                    <motion.p variants={itemVariants} className="hero__eyebrow">
                        Rapports instantanés
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="hero__title">
                        Photo, analyse, PDF officiel<br />en quelques minutes.
                    </motion.h1>
                    <motion.p variants={itemVariants} className="hero__copy">
                        SiteFlow Pro automatise les rapports de chantier. Capturez une photo sur site,
                        laissez l'IA enrichir les métadonnées et obtenez un PDF propre, prêt à signer.
                    </motion.p>

                    <motion.div variants={itemVariants} className="hero__actions">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--primary"
                            onClick={onStart}
                        >
                            <Map size={18} />
                            + Nouveau chantier
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

                <div className="hero-sites">
                    <div className="hero-sites__header">
                        <div>
                            <h3 className="hero-sites__title">
                                <Building2 size={20} />
                                Vos chantiers
                            </h3>
                            <p className="hero-sites__meta">
                                {loadingSites ? 'Synchronisation...' : `${sites.length} Récents`}
                            </p>
                        </div>
                        <div className="hero-sites__counter">
                            <Layers size={14} />
                            {totalPlans} plans
                        </div>
                    </div>

                    <div className="hero-sites__list">
                        {loadingSites && [...Array(3)].map((_, i) => (
                            <div key={i} className="hero-sites__skeleton">
                                <div className="hero-sites__skeleton-icon" />
                                <div className="hero-sites__skeleton-lines">
                                    <div className="hero-sites__skeleton-line hero-sites__skeleton-line--lg" />
                                    <div className="hero-sites__skeleton-line hero-sites__skeleton-line--sm" />
                                </div>
                            </div>
                        ))}

                        {!loadingSites && sites.length === 0 && (
                            <div className="hero-sites__empty">
                                <div className="hero-sites__empty-icon">
                                    <MapPin />
                                </div>
                                <p>Aucun chantier récent</p>
                                <button onClick={onStart} className="hero-sites__empty-link">
                                    Créer un nouveau chantier
                                </button>
                            </div>
                        )}

                        {!loadingSites && sites.map((site) => (
                            <button
                                key={site.id}
                                onClick={onStart}
                                className="hero-sites__item"
                            >
                                <div className="hero-sites__item-logo">
                                    {branding.logoUrl ? (
                                        <img
                                            src={branding.logoUrl}
                                            alt="Site Logo"
                                            className="hero-sites__item-logo-img"
                                        />
                                    ) : (
                                        <Building2 size={24} />
                                    )}
                                </div>
                                <div className="hero-sites__item-content">
                                    <p className="hero-sites__item-name">
                                        {site.siteName}
                                    </p>
                                    <div className="hero-sites__item-stats">
                                        <span className="hero-sites__item-stat">
                                            <MapPin size={12} />
                                            {site.pointsCount} points
                                        </span>
                                        <span className="hero-sites__item-stat">
                                            <Layers size={12} />
                                            {site.plansCount} plans
                                        </span>
                                    </div>
                                </div>
                                <div className="hero-sites__item-arrow">
                                    <ArrowRight size={20} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
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
