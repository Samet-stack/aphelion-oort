import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, ArrowLeft, MapPin, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export const CameraView: React.FC = () => {
    const navigate = useNavigate();
    const { selectedPlan, setCapturedImage } = useAppStore();
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!selectedPlan) {
            navigate('/select-plan');
        }
    }, [selectedPlan, navigate]);

    if (!selectedPlan) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCapturedImage(e.target.files[0]);
            navigate('/report');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setCapturedImage(e.dataTransfer.files[0]);
            navigate('/report');
        }
    };

    return (
        <div className="view">
            <div className="view__top">
                <button onClick={() => navigate('/select-plan')} className="link-btn">
                    <ArrowLeft size={16} /> Changer de chantier
                </button>
                <div className="stepper">
                    <span className="stepper__item">1. Chantier</span>
                    <span className="stepper__item stepper__item--active">2. Photos</span>
                    <span className="stepper__item">3. Rapport</span>
                </div>
            </div>

            {/* Info du chantier sélectionné */}
            <div className="card mb-4" style={{
                background: 'rgba(255, 183, 3, 0.1)',
                borderColor: 'rgba(255, 183, 3, 0.3)',
                padding: '16px 20px'
            }}>
                <div className="flex items-center gap-3">
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'rgba(255, 183, 3, 0.2)',
                        display: 'grid',
                        placeItems: 'center'
                    }}>
                        <Building2 size={20} color="#ffb703" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 2 }}>
                            {selectedPlan.siteName}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                            <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                            {selectedPlan.address || 'Adresse non renseignée'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="card camera">
                <div className="camera__header">
                    <h2>Nouvelle capture terrain</h2>
                    <p>Photographiez l&apos;anomalie ou importez une image existante pour ce chantier.</p>
                </div>

                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={inputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />

                <div
                    className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <div className="dropzone__icon">
                        <Camera size={28} />
                    </div>
                    <p className="dropzone__title">Deposez la photo ou touchez pour capturer</p>
                    <p className="dropzone__hint">Formats JPG, PNG. Qualite recommandee 1080p.</p>
                </div>

                <div className="camera__actions">
                    <button className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                        <Camera size={18} />
                        Ouvrir la camera
                    </button>
                    <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
                        <Upload size={18} />
                        Importer un fichier
                    </button>
                </div>
            </div>
        </div>
    );
};
