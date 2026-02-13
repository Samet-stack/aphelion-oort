import React, { useRef, useState } from 'react';
import { Camera, Upload, ArrowLeft, MapPin, Building2 } from 'lucide-react';
import { ApiPlan } from '../services/api';
import { optimizeImageForUpload } from '../services/image-optimize';

interface CameraViewProps {
    onCapture: (file: File) => void;
    onBack: () => void;
    selectedPlan: ApiPlan;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onBack, selectedPlan }) => {
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationHint, setOptimizationHint] = useState<string | null>(null);

    const processAndCapture = async (file: File) => {
        setIsOptimizing(true);
        setOptimizationHint(null);
        try {
            const optimizedFile = await optimizeImageForUpload(file);
            if (optimizedFile.size < file.size) {
                const savedPercent = Math.round((1 - optimizedFile.size / file.size) * 100);
                setOptimizationHint(`Photo optimisée: -${savedPercent}%`);
            }
            onCapture(optimizedFile);
        } catch (error) {
            console.error('Image optimization failed, using original file', error);
            onCapture(file);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            void processAndCapture(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            void processAndCapture(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="view">
            <div className="view__top">
                <button type="button" onClick={onBack} className="link-btn">
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
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />

                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
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
                    onClick={() => {
                        if (!isOptimizing) {
                            cameraInputRef.current?.click();
                        }
                    }}
                >
                    <div className="dropzone__icon">
                        <Camera size={28} />
                    </div>
                    <p className="dropzone__title">Deposez la photo ou touchez pour capturer</p>
                    <p className="dropzone__hint">Formats JPG, PNG. Qualite recommandee 1080p.</p>
                </div>

                {isOptimizing && <p className="hint-text">Optimisation de la photo en cours...</p>}
                {!isOptimizing && optimizationHint && <p className="hint-text">{optimizationHint}</p>}

                <div className="camera__actions">
                    <button
                        type="button"
                        className="btn btn--primary pressable"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isOptimizing}
                    >
                        <Camera size={18} />
                        {isOptimizing ? 'Optimisation...' : 'Ouvrir la camera'}
                    </button>
                    <button
                        type="button"
                        className="btn btn--ghost pressable"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isOptimizing}
                    >
                        <Upload size={18} />
                        Importer un fichier
                    </button>
                </div>
            </div>
        </div>
    );
};
