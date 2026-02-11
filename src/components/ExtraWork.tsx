import React, { useRef, useState } from 'react';
import { Plus, X, PenTool, Check, AlertCircle } from 'lucide-react';

export interface ExtraWorkItem {
    id: string;
    description: string;
    estimatedCost: number;
    urgency: 'low' | 'medium' | 'high';
    category: string;
    createdAt: string;
}

interface ExtraWorkProps {
    items: ExtraWorkItem[];
    onAdd: (item: Omit<ExtraWorkItem, 'id' | 'createdAt'>) => void;
    onRemove: (id: string) => void;
    onSignature: (signatureDataUrl: string) => void;
    signature?: string;
    readOnly?: boolean;
}

export const ExtraWorkManager: React.FC<ExtraWorkProps> = ({
    items,
    onAdd,
    onRemove,
    onSignature,
    signature,
    readOnly = false
}) => {
    const [showForm, setShowForm] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [description, setDescription] = useState('');
    const [cost, setCost] = useState('');
    const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
    const [category, setCategory] = useState('other');
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const categories = [
        { id: 'peinture', label: 'Peinture' },
        { id: 'electricite', label: 'Électricité' },
        { id: 'plomberie', label: 'Plomberie' },
        { id: 'maconnerie', label: 'Maçonnerie' },
        { id: 'menuiserie', label: 'Menuiserie' },
        { id: 'sol', label: 'Sol/Carrelage' },
        { id: 'isolation', label: 'Isolation' },
        { id: 'other', label: 'Autre' }
    ];

    const handleAdd = () => {
        if (!description.trim()) return;
        
        onAdd({
            description: description.trim(),
            estimatedCost: parseFloat(cost) || 0,
            urgency,
            category
        });
        
        // Reset form
        setDescription('');
        setCost('');
        setUrgency('medium');
        setCategory('other');
        setShowForm(false);
    };

    // Canvas signature
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        setIsDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSignature(dataUrl);
        setShowSignature(false);
    };

    const getUrgencyColor = (u: string) => {
        switch (u) {
            case 'high': return 'badge--danger';
            case 'medium': return 'badge--warning';
            default: return 'badge--info';
        }
    };

    const getUrgencyLabel = (u: string) => {
        switch (u) {
            case 'high': return 'Urgent';
            case 'medium': return 'Moyen';
            default: return 'Faible';
        }
    };

    const totalCost = items.reduce((sum, item) => sum + item.estimatedCost, 0);

    return (
        <div className="extra-work">
            <div className="extra-work__header">
                <div>
                    <h3 className="extra-work__title">
                        <AlertCircle size={18} />
                        Travaux Supplémentaires
                    </h3>
                    <p className="extra-work__subtitle">
                        {items.length} item(s) • Total estimé: {totalCost.toLocaleString('fr-FR')} €
                    </p>
                </div>
                {!readOnly && (
                    <div className="extra-work__actions">
                        {!signature ? (
                            <button 
                                className="btn btn--ghost" 
                                onClick={() => setShowSignature(true)}
                            >
                                <PenTool size={16} />
                                Signature client
                            </button>
                        ) : (
                            <span className="badge badge--success">
                                <Check size={12} /> Signé
                            </span>
                        )}
                        <button 
                            className="btn btn--danger" 
                            onClick={() => setShowForm(true)}
                        >
                            <Plus size={16} />
                            Ajouter TS
                        </button>
                    </div>
                )}
            </div>

            {signature && (
                <div className="extra-work__signature-preview">
                    <img src={signature} alt="Signature client" />
                    <span>Signature client validée</span>
                </div>
            )}

            {items.length > 0 ? (
                <div className="extra-work__list">
                    {items.map((item) => (
                        <div key={item.id} className={`extra-work__item extra-work__item--${item.urgency}`}>
                            <div className="extra-work__item-content">
                                <div className="extra-work__item-main">
                                    <span className="badge badge--info">{categories.find(c => c.id === item.category)?.label || item.category}</span>
                                    <span className={`badge ${getUrgencyColor(item.urgency)}`}>{getUrgencyLabel(item.urgency)}</span>
                                </div>
                                <p className="extra-work__item-desc">{item.description}</p>
                                <p className="extra-work__item-cost">{item.estimatedCost.toLocaleString('fr-FR')} € HT</p>
                            </div>
                            {!readOnly && (
                                <button 
                                    className="btn btn--ghost btn--danger" 
                                    onClick={() => onRemove(item.id)}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="extra-work__empty">
                    Aucun travail supplémentaire déclaré.
                    <br />
                    <small>Cliquez sur "Ajouter TS" pour déclarer des travaux hors contrat.</small>
                </div>
            )}

            {/* Modal: Ajouter TS */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3>Nouveau Travail Supplémentaire</h3>
                            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal__body">
                            <div className="form-field">
                                <label>Description *</label>
                                <textarea
                                    className="textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ex: Peinture écaillée couloir sud à refaire..."
                                    rows={3}
                                />
                            </div>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label>Coût estimé (€ HT)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="10"
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Catégorie</label>
                                    <select
                                        className="input select"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-field">
                                <label>Urgence</label>
                                <div className="urgency-selector">
                                    {(['low', 'medium', 'high'] as const).map((u) => (
                                        <button
                                            key={u}
                                            className={`urgency-btn urgency-btn--${u} ${urgency === u ? 'urgency-btn--active' : ''}`}
                                            onClick={() => setUrgency(u)}
                                        >
                                            {getUrgencyLabel(u)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal__footer">
                            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Annuler</button>
                            <button 
                                className="btn btn--primary" 
                                onClick={handleAdd}
                                disabled={!description.trim()}
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Signature */}
            {showSignature && (
                <div className="modal-overlay" onClick={() => setShowSignature(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3><PenTool size={18} /> Signature client</h3>
                            <button type="button" className="btn btn--ghost" onClick={() => setShowSignature(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal__body">
                            <p className="detail-sub" style={{ marginBottom: '16px' }}>
                                Demandez au client de signer pour validation des travaux supplémentaires.
                            </p>
                            <div className="signature-canvas-wrapper">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={150}
                                    className="signature-canvas"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>
                            <button type="button" className="link-btn" onClick={clearSignature} style={{ marginTop: '12px' }}>
                                Effacer la signature
                            </button>
                        </div>
                        <div className="modal__footer">
                            <button type="button" className="btn btn--ghost" onClick={() => setShowSignature(false)}>Annuler</button>
                            <button type="button" className="btn btn--primary" onClick={saveSignature}>
                                <Check size={16} /> Valider la signature
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
