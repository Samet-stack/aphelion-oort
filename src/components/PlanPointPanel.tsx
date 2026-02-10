import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Trash2, Edit2, MapPin, FileText } from 'lucide-react';
import { ApiPlanPoint } from '../services/api';
import { PlanPointDetailContent } from './PlanPointDetail';
import { PlanPointFormFields, PlanPointFormData } from './PlanPointForm';

export interface PlanPointPanelProps {
  isOpen: boolean;
  mode: 'detail' | 'edit' | 'create';
  point?: ApiPlanPoint;
  points: ApiPlanPoint[];
  onClose: () => void;
  onSave: (data: PlanPointFormData) => void;
  onDelete: (pointId: string) => void;
  onEdit: () => void;
  onNavigate: (point: ApiPlanPoint) => void;
  onFocusPoint?: (point: ApiPlanPoint) => void;
  onDownloadPointPdf?: (point: ApiPlanPoint) => void;
  onUpdateStatus?: (pointId: string, status: ApiPlanPoint['status']) => void;
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
};

export const PlanPointPanel: React.FC<PlanPointPanelProps> = ({
  isOpen,
  mode,
  point,
  points,
  onClose,
  onSave,
  onDelete,
  onEdit,
  onNavigate,
  onFocusPoint,
  onDownloadPointPdf,
  onUpdateStatus,
}) => {
  const isMobile = useIsMobile();

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Sorted points for prev/next navigation
  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => a.pointNumber - b.pointNumber),
    [points]
  );

  const currentIndex = point ? sortedPoints.findIndex((p) => p.id === point.id) : -1;
  const prevPoint = currentIndex > 0 ? sortedPoints[currentIndex - 1] : null;
  const nextPoint = currentIndex < sortedPoints.length - 1 ? sortedPoints[currentIndex + 1] : null;

  const handleDelete = () => {
    if (!point) return;
    onDelete(point.id);
  };

  // Title
  const title =
    mode === 'create'
      ? 'Nouveau point'
      : mode === 'edit'
        ? 'Modifier le point'
        : point
          ? `Point #${point.pointNumber}`
          : '';

  // Animation variants
  const desktopVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: 0 },
  };

  const mobileVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
  };

  const variants = isMobile ? mobileVariants : desktopVariants;

  const statusOptions: Array<{ id: ApiPlanPoint['status']; label: string }> = [
    { id: 'a_faire', label: 'À faire' },
    { id: 'en_cours', label: 'En cours' },
    { id: 'termine', label: 'Terminé' },
  ];

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          {isMobile && (
            <motion.div
              className="plan-panel__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
            />
          )}

          <motion.div
            className={`plan-panel ${isMobile ? 'plan-panel--mobile' : 'plan-panel--desktop'}`}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Header */}
            <div className="plan-panel__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <button
                  className="btn btn--ghost"
                  onClick={onClose}
                  style={{ padding: '6px', flexShrink: 0 }}
                >
                  <X size={18} />
                </button>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {title}
                </h3>
              </div>

              {/* Prev / Next navigation (only in detail mode) */}
              {mode === 'detail' && point && (
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    className="btn btn--ghost"
                    onClick={() => prevPoint && onNavigate(prevPoint)}
                    disabled={!prevPoint}
                    style={{ padding: '6px' }}
                    title="Point precedent"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => nextPoint && onNavigate(nextPoint)}
                    disabled={!nextPoint}
                    style={{ padding: '6px' }}
                    title="Point suivant"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="plan-panel__body">
              {mode === 'detail' && point && (
                <div className="plan-panel__quick">
                  <div className="plan-panel__quick-actions">
                    {onFocusPoint && (
                      <button className="btn btn--ghost" onClick={() => onFocusPoint(point)}>
                        <MapPin size={16} /> Voir sur le plan
                      </button>
                    )}
                    {onDownloadPointPdf && (
                      <button className="btn btn--ghost" onClick={() => onDownloadPointPdf(point)}>
                        <FileText size={16} /> Fiche PDF
                      </button>
                    )}
                  </div>

                  {onUpdateStatus && (
                    <div className="plan-panel__status-segment" role="group" aria-label="Statut">
                      {statusOptions.map((opt) => {
                        const isActive = opt.id === point.status;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`plan-panel__segment-btn${isActive ? ' plan-panel__segment-btn--active' : ''}`}
                            onClick={() => onUpdateStatus(point.id, opt.id)}
                            disabled={isActive}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {mode === 'detail' && point && (
                <PlanPointDetailContent point={point} />
              )}

              {(mode === 'edit' || mode === 'create') && (
                <PlanPointFormFields
                  onSave={onSave}
                  onCancel={onClose}
                  initialData={
                    mode === 'edit' && point
                      ? {
                          title: point.title,
                          description: point.description || '',
                          category: point.category,
                          photoDataUrl: point.photoDataUrl,
                          dateLabel: point.dateLabel,
                          room: point.room || '',
                          status: point.status,
                        }
                      : undefined
                  }
                  isEdit={mode === 'edit'}
                />
              )}
            </div>

            {/* Footer (detail mode only) */}
            {mode === 'detail' && point && (
              <div className="plan-panel__footer">
                <button
                  className="btn btn--ghost"
                  onClick={handleDelete}
                  style={{ color: 'var(--danger)', padding: '10px 16px' }}
                >
                  <Trash2 size={16} /> Supprimer
                </button>
                <button
                  className="btn btn--primary"
                  onClick={onEdit}
                  style={{ padding: '10px 16px' }}
                >
                  <Edit2 size={16} /> Modifier
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
