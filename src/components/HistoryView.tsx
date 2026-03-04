import React, { useState } from 'react';
import { ArrowLeft, Trash2, Download, Euro, ClipboardList, Share2, FileSpreadsheet, CloudOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ShareReportModal } from './ShareReportModal';
import { ExportModal } from './ExportModal';
import { branding } from '../config/branding';
import type { ApiReport } from '../services/api';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const HistoryView: React.FC = () => {
    const navigate = useNavigate();
    const { reports, deleteReport, stats, isLoading, user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [sharingReport, setSharingReport] = useState<ApiReport | null>(null);
    const [showExport, setShowExport] = useState(false);

    // Filtrer les rapports
    const filteredReports = reports.filter(report => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            report.reportId.toLowerCase().includes(query) ||
            report.siteName?.toLowerCase().includes(query) ||
            report.clientName?.toLowerCase().includes(query) ||
            report.address.toLowerCase().includes(query)
        );
    });

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer ce rapport définitivement ?')) return;
        try {
            await deleteReport(id);
            toast.success('Rapport supprimé');
        } catch (err) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleDownload = async (report: ApiReport) => {
        setDownloadingId(report.id);
        try {
            const { generatePremiumPDF } = await import('../services/pdf-premium');
            await generatePremiumPDF({
                imageDataUrl: report.imageDataUrl,
                address: report.address,
                description: report.description,
                date: report.dateLabel,
                coordinates: report.coordinates,
                accuracy: report.accuracy,
                locationSource: report.locationSource as 'gps' | 'demo' | 'unavailable',
                reportId: report.reportId,
                companyName: user?.companyName || branding.companyName,
                reportTitle: branding.reportTitle,
                productName: branding.productName,
                logoUrl: branding.logoUrl,
                siteName: report.siteName,
                operatorName: report.operatorName,
                clientName: report.clientName,
                priority: report.priority,
                category: report.category as 'safety' | 'progress' | 'anomaly' | 'other',
                integrityHash: report.integrityHash,
                extraWorks: report.extraWorks,
                clientSignature: report.clientSignature,
            });
            toast.success('PDF généré avec succès');
        } catch (err) {
            toast.error('Erreur lors de la génération du PDF');
        } finally {
            setDownloadingId(null);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    if (isLoading) {
        return (
            <div className="view">
                <div className="card analysis" style={{ padding: '3rem' }}>
                    <div className="spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    <p>Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="view history-page">
            <motion.div
                className="view__top"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <button onClick={() => navigate('/')} className="link-btn">
                    <ArrowLeft size={16} /> Retour
                </button>
                <div className="stepper">
                    <span className="stepper__item stepper__item--active">Historique Cloud</span>
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div
                className="stat-grid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
            >
                <div className="stat-card">
                    <span className="stat-value">{stats.totalReports}</span>
                    <span className="stat-label">Rapports</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value stat-value--warning">{stats.totalExtraWorks}</span>
                    <span className="stat-label">Travaux Supp.</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value stat-value--success">{stats.totalExtraValue.toLocaleString('fr-FR')}€</span>
                    <span className="stat-label">Valeur TS</span>
                </div>
            </motion.div>

            {/* Search */}
            <motion.div
                className="history__search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par chantier, client, adresse..."
                    className="input"
                />
            </motion.div>

            {/* Liste */}
            <section className="card history history-panel">
                <div className="history__header history-panel__header">
                    <h2>
                        Mes rapports <span className="history-panel__count">({filteredReports.length})</span>
                    </h2>
                </div>

                {filteredReports.length === 0 ? (
                    <div className="history__empty history-panel__empty">
                        <ClipboardList size={44} />
                        <p>Aucun rapport trouve.</p>
                        <p className="detail-sub">
                            {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier rapport'}
                        </p>
                    </div>
                ) : (
                    <motion.div
                        className="history__list"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredReports.map((report) => {
                            const isLocal = report.id.startsWith('local-');
                            return (
                                <motion.article
                                    key={report.id}
                                    className={`history-card ${isLocal ? 'history-card--local' : ''}`}
                                    variants={itemVariants}
                                    whileHover={{ y: -2 }}
                                >
                                    <div className="history-card__media">
                                        {report.imageDataUrl ? (
                                            <img src={report.imageDataUrl} alt="Aperçu" />
                                        ) : (
                                            <div className="history-card__placeholder">Aperçu indisponible</div>
                                        )}
                                    </div>
                                    <div className="history-card__body">
                                        <div className="history-card__meta">
                                            <span className="history-card__id">{report.reportId}</span>
                                            <span className="history-card__date">{report.dateLabel}</span>
                                            {isLocal && (
                                                <span className="badge badge--warning history-card__sync-badge">
                                                    <CloudOff size={12} />
                                                    En attente de synchro
                                                </span>
                                            )}
                                        </div>
                                        <div className="history-card__details">
                                            {report.siteName && (
                                                <span className="history-card__site">{report.siteName}</span>
                                            )}
                                            {report.clientName && (
                                                <span className="detail-sub">Client: {report.clientName}</span>
                                            )}
                                            <span className="detail-sub">{report.address}</span>
                                            {report.extraWorks && report.extraWorks.length > 0 && (
                                                <span className="badge badge--info history-card__ts">
                                                    <Euro size={12} />
                                                    {report.extraWorks.length} TS • {report.extraWorks.reduce((s, w) => s + w.estimatedCost, 0)}€
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="history-card__actions">
                                        <button
                                            className="btn btn--ghost"
                                            onClick={() => handleDownload(report)}
                                            disabled={downloadingId === report.id}
                                            title="Télécharger PDF"
                                        >
                                            {downloadingId === report.id ? '...' : <Download size={16} />}
                                        </button>
                                        <button
                                            className="btn btn--ghost"
                                            onClick={() => setSharingReport(report)}
                                            title="Partager"
                                            disabled={isLocal}
                                        >
                                            <Share2 size={16} />
                                        </button>
                                        <button
                                            className="btn btn--ghost btn--danger"
                                            onClick={() => handleDelete(report.id)}
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.article>
                            )
                        })}
                    </motion.div>
                )}
            </section>

            {/* Boutons d'export */}
            <motion.div
                className="history-export-fab"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <button
                    onClick={() => setShowExport(true)}
                    className="btn btn--primary btn--pill"
                >
                    <FileSpreadsheet size={20} />
                    <span>Exporter</span>
                </button>
            </motion.div>

            {/* Modal partage */}
            {sharingReport && (
                <ShareReportModal
                    reportId={sharingReport.id}
                    siteName={sharingReport.siteName}
                    onClose={() => setSharingReport(null)}
                />
            )}

            {/* Modal export */}
            {showExport && (
                <ExportModal
                    onClose={() => setShowExport(false)}
                />
            )}
        </div>
    );
};
