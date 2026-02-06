import React, { useState } from 'react';
import { ArrowLeft, Trash2, Download, Euro, ClipboardList, Share2, FileSpreadsheet, CloudOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generatePremiumPDF } from '../services/pdf-premium';
import { ShareReportModal } from './ShareReportModal';
import { ExportModal } from './ExportModal';
import { branding } from '../config/branding';
import type { ApiReport } from '../services/api';

interface HistoryViewProps {
    onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
    const { reports, deleteReport, stats, isLoading } = useAuth();
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
        } catch (err) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleDownload = async (report: ApiReport) => {
        setDownloadingId(report.id);
        try {
            await generatePremiumPDF({
                imageDataUrl: report.imageDataUrl,
                address: report.address,
                description: report.description,
                date: report.dateLabel,
                coordinates: report.coordinates,
                accuracy: report.accuracy,
                locationSource: report.locationSource as 'gps' | 'demo' | 'unavailable',
                reportId: report.reportId,
                companyName: branding.companyName,
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
        } catch (err) {
            alert('Erreur lors de la génération du PDF');
        } finally {
            setDownloadingId(null);
        }
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
        <div className="view">
            <div className="view__top">
                <button onClick={onBack} className="link-btn">
                    <ArrowLeft size={16} /> Retour
                </button>
                <div className="stepper">
                    <span className="stepper__item stepper__item--active">Historique Cloud</span>
                </div>
            </div>

            {/* Stats */}
            <div className="stat-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.totalReports}</span>
                    <span className="stat-label">Rapports</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value" style={{ color: 'var(--accent)' }}>{stats.totalExtraWorks}</span>
                    <span className="stat-label">Travaux Supp.</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value" style={{ color: 'var(--success)' }}>{stats.totalExtraValue.toLocaleString('fr-FR')}€</span>
                    <span className="stat-label">Valeur TS</span>
                </div>
            </div>

            {/* Search */}
            <div className="history__search" style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par chantier, client, adresse..."
                    className="input"
                />
            </div>

            {/* Liste */}
            <section className="card history">
                <div className="history__header" style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Mes Rapports ({filteredReports.length})</h2>
                </div>

                {filteredReports.length === 0 ? (
                    <div className="history__empty">
                        <ClipboardList size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <p>Aucun rapport trouvé.</p>
                        <p className="detail-sub" style={{ marginTop: '8px' }}>
                            {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier rapport'}
                        </p>
                    </div>
                ) : (
                    <div className="history__list">
                        {filteredReports.map((report) => {
                            const isLocal = report.id.startsWith('local-');
                            return (
                                <article key={report.id} className={`history-card ${isLocal ? 'history-card--local' : ''}`}>
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
                                                <span className="badge badge--warning" style={{ marginTop: '4px' }}>
                                                    <CloudOff size={12} />
                                                    En attente de synchro
                                                </span>
                                            )}
                                        </div>
                                        <div className="history-card__details">
                                            {report.siteName && (
                                                <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{report.siteName}</span>
                                            )}
                                            {report.clientName && (
                                                <span className="detail-sub" style={{ color: 'var(--text)' }}>Client: {report.clientName}</span>
                                            )}
                                            <span className="detail-sub">{report.address}</span>
                                            {report.extraWorks && report.extraWorks.length > 0 && (
                                                <span className="badge badge--info" style={{ marginTop: '4px', width: 'fit-content' }}>
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
                                </article>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Boutons d'export */}
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}>
                <button
                    onClick={() => setShowExport(true)}
                    className="btn btn--primary btn--pill"
                    style={{ padding: '12px 24px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', border: '1px solid var(--stroke)' }}
                >
                    <FileSpreadsheet size={18} />
                    <span>Exporter</span>
                </button>
            </div>

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
