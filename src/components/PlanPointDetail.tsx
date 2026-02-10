import React, { useState } from 'react';
import { X, Edit2, Trash2, MapPin, Calendar, Tag } from 'lucide-react';
import { ApiPlanPoint } from '../services/api';
import { ConfirmModal } from './ui/ConfirmModal';

interface PlanPointDetailProps {
  point: ApiPlanPoint;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

interface PlanPointDetailContentProps {
  point: ApiPlanPoint;
}

const categoryLabels: Record<string, string> = {
  radiateur: 'Radiateur',
  electricite: 'Electricite',
  defaut: 'Defaut',
  validation: 'Validation',
  plomberie: 'Plomberie',
  maconnerie: 'Maconnerie',
  menuiserie: 'Menuiserie',
  autre: 'Autre',
};

const statusLabels: Record<string, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  termine: 'Termine',
};

const statusBadge: Record<string, string> = {
  a_faire: 'badge--danger',
  en_cours: 'badge--warning',
  termine: 'badge--success',
};

const categoryBadge: Record<string, string> = {
  defaut: 'badge--danger',
  validation: 'badge--success',
};


export const PlanPointDetailContent: React.FC<PlanPointDetailContentProps> = ({ point }) => {
  const isProblem = point.status === 'a_faire' || point.category === 'defaut';

  return (
    <div className={`plan-detail-content ${isProblem ? 'problem-highlight' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Hero Photo with Gradient Overlay */}
      <div className="plan-detail__hero" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
        <img
          src={point.photoDataUrl}
          alt={point.title}
          style={{
            width: '100%',
            height: '240px',
            objectFit: 'cover',
            display: 'block'
          }}
        />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`badge ${categoryBadge[point.category] || 'badge--info'}`}>
              <Tag size={12} /> {categoryLabels[point.category] || point.category}
            </span>
            {isProblem && (
              <span className="badge" style={{ background: '#ef4444', color: 'white', border: 'none', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }}>
                <span className="problem-pulse-indicator" style={{ background: 'white', width: '8px', height: '8px', marginRight: '6px' }} />
                Problème détecté
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Title & Status */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2 }}>{point.title}</h4>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} />
            <span>{point.dateLabel}</span>
          </div>
          {point.room && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} />
              <span>{point.room}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />

      {/* Description */}
      {point.description ? (
        <div className="plan-panel__desc">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</p>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-main)' }}>{point.description}</p>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune description.</p>
      )}

      {/* Status Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Statut actuel</span>
        <span className={`badge ${statusBadge[point.status] || 'badge--info'}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
          {statusLabels[point.status] || point.status}
        </span>
      </div>

    </div>
  );
};

export const PlanPointDetail: React.FC<PlanPointDetailProps> = ({ point, onClose, onEdit, onDelete }) => {
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    setConfirmOpen(true);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
          <div className="modal__header">
            <h3>Point #{point.pointNumber} — {point.title}</h3>
            <button className="btn btn--ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="modal__body">
            <PlanPointDetailContent point={point} />
          </div>
          <div className="modal__footer">
            <button className="btn btn--ghost" onClick={handleDelete} style={{ color: 'var(--danger)' }}>
              <Trash2 size={16} /> Supprimer
            </button>
            <button className="btn btn--primary" onClick={onEdit}>
              <Edit2 size={16} /> Modifier
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        title="Supprimer ce point ?"
        message={`Supprimer le point "${point.title}". Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
      />
    </>
  );
};
