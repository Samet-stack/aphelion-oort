import React, { useRef, useState } from 'react';
import { X, Camera, Upload } from 'lucide-react';

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

interface PlanPointFormFieldsProps {
  onSave: (data: PlanPointFormData) => void;
  onCancel: () => void;
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

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Screenshots (PNG) need more resolution and lossless encoding to keep text readable in PDFs.
        const isPng = file.type === 'image/png';
        const maxW = isPng ? 2400 : 2000;
        const maxH = isPng ? 3200 : 2000;
        const jpegQuality = 0.88;

        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const needsResize = w > maxW || h > maxH;

        // Avoid touching PNG screenshots if we don't need to resize them (keeps text crisp).
        if (isPng && !needsResize) {
          resolve(src);
          return;
        }

        if (needsResize) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = needsResize;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', jpegQuality));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
};

export const PlanPointFormFields: React.FC<PlanPointFormFieldsProps> = ({ onSave, onCancel, initialData, isEdit }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || 'autre');
  const [photoDataUrl, setPhotoDataUrl] = useState(initialData?.photoDataUrl || '');
  const [dateLabel, setDateLabel] = useState(
    initialData?.dateLabel || new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
  );
  const [room, setRoom] = useState(initialData?.room || '');
  const [status, setStatus] = useState<'a_faire' | 'en_cours' | 'termine'>(initialData?.status || 'a_faire');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const dataUrl = await fileToDataUrl(e.target.files[0]);
      setPhotoDataUrl(dataUrl);
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
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Photo */}
        <div className="form-field" style={{ marginBottom: '4px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Photo *</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={inputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          {photoDataUrl ? (
            <div style={{ position: 'relative' }}>
              <img src={photoDataUrl} alt="Preview" className="point-photo-preview" style={{ marginBottom: '12px' }} />
              <button
                className="btn btn--ghost"
                onClick={() => inputRef.current?.click()}
                style={{ width: '100%' }}
              >
                <Camera size={16} /> Changer la photo
              </button>
            </div>
          ) : (
            <div className="camera__actions" style={{ gap: '12px' }}>
              <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                <Camera size={16} /> Prendre une photo
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
                <Upload size={16} /> Importer
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
            placeholder="Ex: Radiateur Salon"
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
            placeholder="Details supplementaires..."
            rows={3}
            style={{ padding: '12px 14px' }}
          />
        </div>

        {/* Categorie + Statut */}
        <div className="form-grid" style={{ gap: '16px' }}>
          <div className="form-field" style={{ marginBottom: '4px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Categorie</label>
            <select className="input select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '12px 14px' }}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ marginBottom: '4px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Statut</label>
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
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Lieu / Piece</label>
            <input
              type="text"
              className="input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ex: Salon, Chambre 2..."
              style={{ padding: '12px 14px' }}
            />
          </div>
        </div>
      </div>
      <div className="plan-panel__form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} style={{ padding: '12px 20px' }}>Annuler</button>
        <button
          className="btn btn--primary"
          onClick={handleSave}
          disabled={!canSave}
          style={{ padding: '12px 24px' }}
        >
          {isEdit ? 'Enregistrer' : 'Ajouter le point'}
        </button>
      </div>
    </>
  );
};

export const PlanPointForm: React.FC<PlanPointFormProps> = ({ onSave, onClose, initialData, isEdit }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal__header" style={{ padding: '20px 24px' }}>
          <h3>{isEdit ? 'Modifier le point' : 'Nouveau point'}</h3>
          <button type="button" className="btn btn--ghost" onClick={onClose} style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <PlanPointFormFields
            onSave={onSave}
            onCancel={onClose}
            initialData={initialData}
            isEdit={isEdit}
          />
        </div>
      </div>
    </div>
  );
};
