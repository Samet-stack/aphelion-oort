import React from 'react';
import { X, Edit2, Trash2, MapPin, Calendar, Tag } from 'lucide-react';
import { ApiPlanPoint } from '../services/api';

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
  return (
    <>
      {/* Photo */}
      <img
        src={point.photoDataUrl}
        alt={point.title}
        className="plan-panel__photo"
        style={{
          width: '100%',
          borderRadius: '12px',
          border: '1px solid var(--stroke)',
          maxHeight: '300px',
          objectFit: 'contain',
          background: 'rgba(0,0,0,0.2)',
        }}
      />

      {/* Badges */}
      <div className="plan-panel__badges" style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <span className={`badge ${categoryBadge[point.category] || 'badge--info'}`}>
          <Tag size={12} /> {categoryLabels[point.category] || point.category}
        </span>
        <span className={`badge ${statusBadge[point.status] || 'badge--info'}`}>
          {statusLabels[point.status] || point.status}
        </span>
      </div>

      {/* Description */}
      {point.description && (
        <div className="plan-panel__desc" style={{ marginTop: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Description</p>
          <p style={{ fontSize: '0.95rem' }}>{point.description}</p>
        </div>
      )}

      {/* Meta */}
      <div className="plan-panel__meta" style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span>{point.dateLabel}</span>
        </div>
        {point.room && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
            <span>{point.room}</span>
          </div>
        )}
      </div>
    </>
  );
};

export const PlanPointDetail: React.FC<PlanPointDetailProps> = ({ point, onClose, onEdit, onDelete }) => {
  const handleDelete = () => {
    if (window.confirm(`Supprimer le point "${point.title}" ?`)) {
      onDelete();
    }
  };

  return (
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
  );
};
