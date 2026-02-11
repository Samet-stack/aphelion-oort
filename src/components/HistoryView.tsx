import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Trash2, Download, Euro, ClipboardList, Share2, FileSpreadsheet, CloudOff } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuth } from '../contexts/AuthContext';
import { ShareReportModal } from './ShareReportModal';
import { ExportModal } from './ExportModal';
import { branding } from '../config/branding';
import { reportsApi, type ApiReport } from '../services/api';
import { motion } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from './ui/ConfirmModal';
import { closePendingPdfTab, openPendingPdfTab, presentPdfBlob } from '../services/pdf-open';

interface HistoryViewProps {
  onBack: () => void;
}

const HISTORY_VIRTUALIZE_THRESHOLD = 45;

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
  const { reports, deleteReport, stats, isLoading, refreshReports } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingReport, setSharingReport] = useState<ApiReport | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          report.reportId.toLowerCase().includes(query) ||
          report.siteName?.toLowerCase().includes(query) ||
          report.clientName?.toLowerCase().includes(query) ||
          report.address.toLowerCase().includes(query)
        );
      }),
    [reports, searchQuery],
  );

  const shouldVirtualize = filteredReports.length > HISTORY_VIRTUALIZE_THRESHOLD;
  const virtualScrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? filteredReports.length : 0,
    getScrollElement: () => virtualScrollRef.current,
    estimateSize: () => 248,
    overscan: 6,
  });

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingReports(true);
      try {
        await refreshReports();
      } finally {
        if (active) setLoadingReports(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [refreshReports]);

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteReport(confirmDeleteId);
      toast.success('Rapport supprimé avec succès');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleDownload = async (report: ApiReport) => {
    setDownloadingId(report.id);
    const pendingTab = openPendingPdfTab();
    try {
      const isLocal = report.id.startsWith('local-');
      const fullReport = isLocal || report.imageDataUrl ? report : await reportsApi.getById(report.id);

      const { generatePremiumPDF } = await import('../services/pdf-premium');
      const { blob, filename } = await generatePremiumPDF({
        imageDataUrl: fullReport.imageDataUrl,
        address: fullReport.address,
        description: fullReport.description,
        date: fullReport.dateLabel,
        coordinates: fullReport.coordinates,
        accuracy: fullReport.accuracy,
        locationSource: fullReport.locationSource as 'gps' | 'demo' | 'unavailable',
        reportId: fullReport.reportId,
        companyName: branding.companyName,
        reportTitle: branding.reportTitle,
        productName: branding.productName,
        logoUrl: branding.logoUrl,
        siteName: fullReport.siteName,
        operatorName: fullReport.operatorName,
        clientName: fullReport.clientName,
        priority: fullReport.priority,
        category: fullReport.category as 'safety' | 'progress' | 'anomaly' | 'other',
        integrityHash: fullReport.integrityHash,
        extraWorks: fullReport.extraWorks,
        clientSignature: fullReport.clientSignature,
      });
      presentPdfBlob({ blob, filename, pendingTab });
      toast.success('PDF généré avec succès');
    } catch {
      closePendingPdfTab(pendingTab);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const renderReportCard = (report: ApiReport, animated: boolean) => {
    const isLocal = report.id.startsWith('local-');
    const extraCount = report.extraWorksCount ?? report.extraWorks?.length ?? 0;
    const extraTotal =
      report.extraWorksTotal ?? report.extraWorks?.reduce((sum, work) => sum + (work.estimatedCost || 0), 0) ?? 0;
    const cardClass = `history-card bg-surface border-subtle ${isLocal ? 'history-card--local' : ''}`;

    const cardContent = (
      <>
        <div className="history-card__media">
          {report.imageDataUrl ? (
            <img src={report.imageDataUrl} alt="Aperçu" loading="lazy" decoding="async" className="object-cover" />
          ) : (
            <div className="history-card__placeholder">Aperçu indisponible</div>
          )}
        </div>
        <div className="history-card__body">
          <div className="history-card__meta">
            <span className="history-card__id text-primary">{report.reportId}</span>
            <span className="history-card__date text-muted">{report.dateLabel}</span>
            {isLocal && (
              <span className="badge badge--warning mt-1">
                <CloudOff size={12} />
                En attente de synchro
              </span>
            )}
          </div>
          <div className="history-card__details">
            {report.siteName && <span className="text-lg font-semibold text-main">{report.siteName}</span>}
            {report.clientName && <span className="detail-sub text-muted">Client: {report.clientName}</span>}
            <span className="detail-sub">{report.address}</span>
            {extraCount > 0 && (
              <span className="badge badge--info mt-1 w-fit">
                <Euro size={12} />
                {extraCount} TS • {Math.round(extraTotal).toLocaleString('fr-FR')}€
              </span>
            )}
          </div>
        </div>
        <div className="history-card__actions">
          <button
            className="btn btn--ghost text-muted pressable"
            onClick={() => handleDownload(report)}
            disabled={downloadingId === report.id}
            title="Télécharger PDF"
            aria-label={`Télécharger le PDF du rapport ${report.reportId}`}
          >
            {downloadingId === report.id ? '...' : <Download size={16} />}
          </button>
          <button
            className="btn btn--ghost text-muted pressable"
            onClick={() => setSharingReport(report)}
            title="Partager"
            disabled={isLocal}
            aria-label={`Partager le rapport ${report.reportId}`}
          >
            <Share2 size={16} />
          </button>
          <button
            className="btn btn--ghost btn--danger pressable"
            onClick={() => setConfirmDeleteId(report.id)}
            title="Supprimer"
            aria-label={`Supprimer le rapport ${report.reportId}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </>
    );

    if (!animated) {
      return <article className={cardClass}>{cardContent}</article>;
    }

    return (
      <motion.article className={cardClass} variants={itemVariants} whileHover={{ y: -2, backgroundColor: 'var(--bg-surface-hover)' }}>
        {cardContent}
      </motion.article>
    );
  };

  if (isLoading || loadingReports) {
    return (
      <div className="view">
        <div className="card history bg-transparent shadow-none p-0">
          <div className="history__header mb-4 pl-1">
            <div className="skeleton" style={{ height: 20, width: 210 }} />
          </div>
          <div className="history__list">
            {[0, 1, 2].map((item) => (
              <article key={item} className="history-card bg-surface border-subtle">
                <div className="history-card__media skeleton" />
                <div className="history-card__body">
                  <div className="history-card__meta">
                    <div className="skeleton" style={{ height: 14, width: 120 }} />
                    <div className="skeleton" style={{ height: 12, width: 90 }} />
                  </div>
                  <div className="history-card__details">
                    <div className="skeleton" style={{ height: 18, width: 220 }} />
                    <div className="skeleton" style={{ height: 12, width: 190 }} />
                    <div className="skeleton" style={{ height: 12, width: 240 }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <motion.div className="view__top" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <button type="button" onClick={onBack} className="link-btn text-muted">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="stepper">
          <span className="stepper__item stepper__item--active text-primary">Historique Cloud</span>
        </div>
      </motion.div>

      <motion.div
        className="stat-grid"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="stat-card bg-surface border-subtle">
          <span className="stat-value text-main">{stats.totalReports}</span>
          <span className="stat-label">Rapports</span>
        </div>
        <div className="stat-card bg-surface border-subtle">
          <span className="stat-value text-warning">{stats.totalExtraWorks}</span>
          <span className="stat-label">Travaux Supp.</span>
        </div>
        <div className="stat-card bg-surface border-subtle">
          <span className="stat-value text-success">{stats.totalExtraValue.toLocaleString('fr-FR')}€</span>
          <span className="stat-label">Valeur TS</span>
        </div>
      </motion.div>

      <motion.div className="history__search mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par chantier, client, adresse..."
          className="input-search"
        />
      </motion.div>

      <section className="card history bg-transparent shadow-none p-0">
        <div className="history__header mb-4 pl-1">
          <h2 className="text-xl font-semibold text-main">
            Mes Rapports <span className="text-base text-muted font-normal">({filteredReports.length})</span>
          </h2>
        </div>

        {filteredReports.length === 0 ? (
          <div className="history__empty bg-surface p-16 rounded-md text-center">
            <ClipboardList size={48} className="mx-auto mb-4 opacity-50 text-muted" />
            <p className="text-main">Aucun rapport trouvé.</p>
            <p className="detail-sub mt-2 text-muted">
              {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier rapport'}
            </p>
          </div>
        ) : shouldVirtualize ? (
          <div className="history__virtual-wrap">
            <p className="history__virtual-hint">Mode performance activé pour une grande liste.</p>
            <div className="history__virtual-scroll" ref={virtualScrollRef}>
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const report = filteredReports[virtualRow.index];
                  return (
                    <div
                      key={report.id}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="history__virtual-row"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      {renderReportCard(report, false)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <motion.div className="history__list" variants={containerVariants} initial="hidden" animate="visible">
            {filteredReports.map((report) => (
              <React.Fragment key={report.id}>{renderReportCard(report, true)}</React.Fragment>
            ))}
          </motion.div>
        )}
      </section>

      <motion.div className="fixed bottom-6 right-6 z-50" initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <button
          onClick={() => setShowExport(true)}
          className="btn btn--primary btn--pill pressable"
          style={{
            padding: '16px 32px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-light)',
            fontSize: '1.1rem',
          }}
        >
          <FileSpreadsheet size={20} />
          <span>Exporter</span>
        </button>
      </motion.div>

      {sharingReport && (
        <ShareReportModal reportId={sharingReport.id} siteName={sharingReport.siteName} onClose={() => setSharingReport(null)} />
      )}

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Supprimer le rapport ?"
        message="Cette action est irréversible. Le rapport et toutes les données associées seront définitivement effacés."
        confirmLabel="Supprimer"
        isDestructive
      />
    </div>
  );
};
