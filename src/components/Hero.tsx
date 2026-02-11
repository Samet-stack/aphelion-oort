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

                <div className="w-full bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                    {/* Header */}
                    <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                                <Building2 size={20} className="text-amber-400" />
                                Vos chantiers
                            </h3>
                            <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide uppercase">
                                {loadingSites ? 'Synchronisation...' : `${sites.length} Récents`}
                            </p>
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-2 shadow-inner">
                            <Layers size={14} className="text-amber-400" />
                            {totalPlans} plans
                        </div>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-white/5">
                        {loadingSites && [...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                                <div className="w-12 h-12 rounded-xl bg-white/5" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/3 bg-white/5 rounded" />
                                    <div className="h-3 w-1/2 bg-white/5 rounded" />
                                </div>
                            </div>
                        ))}

                        {!loadingSites && sites.length === 0 && (
                            <div className="p-8 text-center flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10">
                                    <MapPin className="text-slate-500" />
                                </div>
                                <p className="text-slate-400 text-sm">Aucun chantier récent</p>
                                <button onClick={onStart} className="text-amber-400 text-sm font-semibold hover:text-amber-300 transition-colors">
                                    Créer un nouveau chantier
                                </button>
                            </div>
                        )}

                        {!loadingSites && sites.map((site) => (
                            <button
                                key={site.id}
                                onClick={onStart}
                                className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group relative overflow-hidden"
                            >
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10 overflow-hidden relative">
                                    {branding.logoUrl ? (
                                        <img
                                            src={branding.logoUrl}
                                            alt="Site Logo"
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        />
                                    ) : (
                                        <Building2 size={24} className="text-amber-500" />
                                    )}
                                </div>
                                <div className="flex-1 z-10">
                                    <p className="font-semibold text-white group-hover:text-amber-400 transition-colors text-[0.95rem]">
                                        {site.siteName}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} />
                                            {site.pointsCount} points
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Layers size={12} />
                                            {site.plansCount} plans
                                        </span>
                                    </div>
                                </div>
                                <div className="text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all duration-300">
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
