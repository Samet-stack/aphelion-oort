import React, { useEffect, useMemo, useState } from 'react';
import { Camera, FileText, Sparkles, ArrowRight, Map, ShieldCheck, Cloud, Smartphone, Building2, Layers, MapPin, Activity, Clock3, ScanLine } from 'lucide-react';
import { motion } from 'framer-motion';
import { sitesApi, type ApiSiteListItem } from '../services/api';
import { branding } from '../config/branding';

interface HeroProps {
    onStart: (siteId?: string) => void;
    onHistory: () => void;
}

const numberFormat = new Intl.NumberFormat('fr-FR');
const relativeTime = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const sortByRecency = (a: ApiSiteListItem, b: ApiSiteListItem) => {
    const updatedA = Date.parse(a.updatedAt);
    const updatedB = Date.parse(b.updatedAt);
    if (!Number.isNaN(updatedA) && !Number.isNaN(updatedB) && updatedA !== updatedB) {
        return updatedB - updatedA;
    }
    if (!Number.isNaN(updatedA) && Number.isNaN(updatedB)) {
        return -1;
    }
    if (Number.isNaN(updatedA) && !Number.isNaN(updatedB)) {
        return 1;
    }

    const createdA = Date.parse(a.createdAt);
    const createdB = Date.parse(b.createdAt);
    if (!Number.isNaN(createdA) && !Number.isNaN(createdB) && createdA !== createdB) {
        return createdB - createdA;
    }
    if (!Number.isNaN(createdA) && Number.isNaN(createdB)) {
        return -1;
    }
    if (Number.isNaN(createdA) && !Number.isNaN(createdB)) {
        return 1;
    }

    return a.siteName.localeCompare(b.siteName, 'fr');
};

const formatRelativeLabel = (isoDate: string) => {
    const timestamp = Date.parse(isoDate);
    if (Number.isNaN(timestamp)) {
        return 'Mise à jour récente';
    }

    const delta = timestamp - Date.now();
    const absDelta = Math.abs(delta);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (absDelta < hour) {
        return relativeTime.format(Math.round(delta / minute), 'minute');
    }
    if (absDelta < day) {
        return relativeTime.format(Math.round(delta / hour), 'hour');
    }
    return relativeTime.format(Math.round(delta / day), 'day');
};

export const Hero: React.FC<HeroProps> = ({ onStart, onHistory }) => {
    const [sites, setSites] = useState<ApiSiteListItem[]>([]);
    const [loadingSites, setLoadingSites] = useState(true);

    useEffect(() => {
        let active = true;
        const loadSites = async () => {
            try {
                const data = await sitesApi.getAll();
                if (active) {
                    setSites(data);
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
    const totalPoints = useMemo(
        () => sites.reduce((sum, site) => sum + (site.pointsCount || 0), 0),
        [sites]
    );
    const recentSites = useMemo(
        () => [...sites].sort(sortByRecency).slice(0, 5),
        [sites]
    );
    const recentTotalPlans = useMemo(
        () => recentSites.reduce((sum, site) => sum + (site.plansCount || 0), 0),
        [recentSites]
    );
    const featuredSite = recentSites[0] ?? null;
    const compactSites = featuredSite ? recentSites.slice(1, 5) : [];
    const avgPointsPerSite = sites.length ? Math.round(totalPoints / sites.length) : 0;
    const featuredLastUpdate = featuredSite ? formatRelativeLabel(featuredSite.updatedAt) : 'Synchronisation active';

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
                        Votre chantier devient<br />un rapport signé.
                    </motion.h1>
                    <motion.p variants={itemVariants} className="hero__copy">
                        SiteFlow Pro automatise les rapports de chantier. Capturez une photo sur site,
                        laissez l'IA enrichir les métadonnées et obtenez un PDF propre, prêt à signer.
                    </motion.p>

                    <motion.div variants={itemVariants} className="hero__stats">
                        <div className="hero-stat">
                            <p className="hero-stat__label">Chantiers actifs</p>
                            <p className="hero-stat__value">{loadingSites ? '...' : numberFormat.format(sites.length)}</p>
                            <p className="hero-stat__meta">suivis dans votre espace</p>
                        </div>
                        <div className="hero-stat">
                            <p className="hero-stat__label">Plans disponibles</p>
                            <p className="hero-stat__value">{loadingSites ? '...' : numberFormat.format(totalPlans)}</p>
                            <p className="hero-stat__meta">prêts pour capture terrain</p>
                        </div>
                        <div className="hero-stat">
                            <p className="hero-stat__label">Précision terrain</p>
                            <p className="hero-stat__value">{loadingSites ? '...' : `${numberFormat.format(avgPointsPerSite)} pts`}</p>
                            <p className="hero-stat__meta">moyenne par chantier</p>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="hero__actions">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--primary"
                            onClick={() => onStart()}
                            type="button"
                        >
                            <Map size={18} />
                            Nouveau chantier
                            <ArrowRight size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn--ghost"
                            onClick={onHistory}
                            type="button"
                        >
                            Voir l'historique
                        </motion.button>
                    </motion.div>

                    <motion.div variants={itemVariants} className="hero__signal">
                        <span className="hero__assist-dot" />
                        <Activity size={16} />
                        <span>Pipeline IA opérationnel</span>
                        <span className="hero__signal-badge">
                            <Clock3 size={14} />
                            {featuredLastUpdate}
                        </span>
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
                                {loadingSites ? 'Synchronisation...' : `${numberFormat.format(recentSites.length)} récents`}
                            </p>
                        </div>
                        <div className="hero-sites__counter">
                            <Layers size={14} />
                            {loadingSites ? '...' : `${numberFormat.format(recentTotalPlans)} plans`}
                        </div>
                    </div>

                    <div className="hero-sites__featured">
                        {loadingSites && (
                            <div className="hero-sites__featured-card hero-sites__featured-card--skeleton">
                                <div className="hero-sites__featured-top">
                                    <div className="hero-sites__featured-pill skeleton" />
                                    <div className="hero-sites__featured-time skeleton" />
                                </div>
                                <div className="hero-sites__featured-title skeleton" />
                                <div className="hero-sites__featured-subtitle skeleton" />
                                <div className="hero-sites__featured-metrics">
                                    <div className="hero-sites__featured-chip skeleton" />
                                    <div className="hero-sites__featured-chip skeleton" />
                                </div>
                            </div>
                        )}

                        {!loadingSites && featuredSite && (
                            <button onClick={() => onStart(featuredSite.id)} className="hero-sites__featured-card" type="button">
                                <div className="hero-sites__featured-top">
                                    <span className="hero-sites__featured-pill">
                                        <ScanLine size={13} />
                                        Priorité du jour
                                    </span>
                                    <span className="hero-sites__featured-time">{featuredLastUpdate}</span>
                                </div>
                                <h4 className="hero-sites__featured-name">{featuredSite.siteName}</h4>
                                <p className="hero-sites__featured-address">
                                    {featuredSite.address || 'Adresse en attente'}
                                </p>
                                <div className="hero-sites__featured-metrics">
                                    <span className="hero-sites__featured-chip">
                                        <MapPin size={12} />
                                        {featuredSite.pointsCount} points
                                    </span>
                                    <span className="hero-sites__featured-chip">
                                        <Layers size={12} />
                                        {featuredSite.plansCount} plans
                                    </span>
                                </div>
                                <span className="hero-sites__featured-cta">
                                    Ouvrir le chantier
                                    <ArrowRight size={16} />
                                </span>
                            </button>
                        )}
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
                                <button onClick={() => onStart()} className="hero-sites__empty-link" type="button">
                                    Créer un nouveau chantier
                                </button>
                            </div>
                        )}

                        {!loadingSites && compactSites.map((site) => (
                            <button
                                key={site.id}
                                onClick={() => onStart(site.id)}
                                className="hero-sites__item"
                                type="button"
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
                                <div className="hero-sites__item-updated">
                                    {formatRelativeLabel(site.updatedAt)}
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
