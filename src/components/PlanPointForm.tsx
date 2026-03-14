import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { normalizeFileToImageDataUrl, getFileConversionErrorMessage } from '../services/file-conversion';

export interface PlanPointFormData {
  title: string;
  description: string;
  category: string;
  photoDataUrl: string;
  dateLabel: string;
  room: string;
  status: 'a_faire' | 'en_cours' | 'termine';
}

interface PlanPointFormProps {
  onSave: (data: PlanPointFormData) => void;
  onClose: () => void;
  initialData?: Partial<PlanPointFormData>;
  isEdit?: boolean;
}

const categories = [
  { id: 'radiateur', label: 'Radiateur' },
  { id: 'electricite', label: 'Electricite' },
  { id: 'defaut', label: 'Defaut' },
  { id: 'validation', label: 'Validation' },
  { id: 'plomberie', label: 'Plomberie' },
  { id: 'maconnerie', label: 'Maconnerie' },
  { id: 'menuiserie', label: 'Menuiserie' },
  { id: 'autre', label: 'Autre' },
];

const statusOptions = [
  { id: 'a_faire', label: 'A faire' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'termine', label: 'Termine' },
] as const;

// The old `fileToDataUrl` has been removed as we now use `normalizeFileToImageDataUrl`.

export const PlanPointForm: React.FC<PlanPointFormProps> = ({ onSave, onClose, initialData, isEdit }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || 'autre');
  const [photoDataUrl, setPhotoDataUrl] = useState(initialData?.photoDataUrl || '');
  const [dateLabel, setDateLabel] = useState(
    initialData?.dateLabel || new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  );
  const [room, setRoom] = useState(initialData?.room || '');
  const [status, setStatus] = useState<'a_faire' | 'en_cours' | 'termine'>(initialData?.status || 'a_faire');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        setProcessingFile(true);
        const file = e.target.files[0];
        const { dataUrl, sourceType } = await normalizeFileToImageDataUrl(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.85,
        });

        setPhotoDataUrl(dataUrl);
        if (sourceType === 'pdf') {
          toast.success('PDF importé. Page 1 convertie en image.');
        }
      } catch (err) {
        console.error('Error processing point file:', err);
        toast.error(getFileConversionErrorMessage(err));
      } finally {
        setProcessingFile(false);
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleSave = () => {
    if (!title.trim() || !photoDataUrl) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      photoDataUrl,
      dateLabel,
      room: room.trim(),
      status,
    });
  };

  const canSave = title.trim() && photoDataUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-label={isEdit ? 'Modifier le point' : 'Nouveau point'}>
        <div className="modal__header" style={{ padding: '20px 24px' }}>
          <h3>{isEdit ? 'Modifier le point' : 'Nouveau point'}</h3>
          <button className="btn btn--ghost" onClick={onClose} style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Photo */}
          <div className="form-field" style={{ marginBottom: '4px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Photo ou document *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*,application/pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {processingFile ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface-strong)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ color: 'var(--text-muted)' }}>Traitement du fichier...</p>
              </div>
            ) : photoDataUrl ? (
              <div style={{ position: 'relative' }}>
                <img src={photoDataUrl} alt="Preview" className="point-photo-preview" style={{ marginBottom: '12px' }} />
                <button
                  className="btn btn--ghost"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%' }}
                  disabled={processingFile}
                >
                  <Camera size={16} /> Changer le fichier
                </button>
              </div>
            ) : (
              <div className="camera__actions" style={{ gap: '12px' }}>
                <button className="btn btn--primary" onClick={() => cameraInputRef.current?.click()} disabled={processingFile}>
                  <Camera size={16} /> Prendre une photo
                </button>
                <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()} disabled={processingFile}>
                  <Upload size={16} /> Importer image/PDF
                </button>
              </div>
            )}
          </div>

          {/* Titre */}
          <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Titre *</label>
              <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Radiateur salon"
              style={{ padding: '12px 14px' }}
            />
          </div>

          {/* Description */}
          <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Description</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
                placeholder="Ajoutez un detail utile si besoin"
              rows={3}
              style={{ padding: '12px 14px' }}
            />
          </div>

          {/* Categorie + Statut */}
          <div className="form-grid" style={{ gap: '16px' }}>
            <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Type</label>
              <select className="input select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '12px 14px' }}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Etat</label>
              <select
                className="input select"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'a_faire' | 'en_cours' | 'termine')}
                style={{ padding: '12px 14px' }}
              >
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Lieu */}
          <div className="form-grid" style={{ gap: '16px' }}>
            <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Date</label>
              <input
                type="text"
                className="input"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                style={{ padding: '12px 14px' }}
              />
            </div>
            <div className="form-field" style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Lieu / piece</label>
              <input
                type="text"
                className="input"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Ex: Salon, chambre 2"
                style={{ padding: '12px 14px' }}
              />
            </div>
          </div>
        </div>
        <div className="modal__footer" style={{ gap: '12px', padding: '20px 24px' }}>
          <button className="btn btn--ghost" onClick={onClose} style={{ padding: '12px 20px' }}>Annuler</button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={!canSave}
            style={{ padding: '12px 24px' }}
          >
            {isEdit ? 'Enregistrer' : 'Ajouter le point'}
          </button>
        </div>
      </div>
    </div>
  );
};
