import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, ArrowLeft, MapPin, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { getFileConversionErrorMessage, normalizeFileToImageFile, readFileAsDataUrl } from '../services/file-conversion';

export const CameraView: React.FC = () => {
    const navigate = useNavigate();
    const { selectedPlan, setCapturedImage } = useAppStore();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [processingFile, setProcessingFile] = useState(false);

    useEffect(() => {
        if (!selectedPlan) {
            navigate('/select-plan');
        }
    }, [selectedPlan, navigate]);

    if (!selectedPlan) return null;

    const handleSelectedFile = async (file: File) => {
        try {
            setProcessingFile(true);
            const { file: normalizedFile, sourceType } = await normalizeFileToImageFile(file, {
                maxWidth: 2200,
                maxHeight: 2200,
                quality: 0.86,
            });

            if (sourceType === 'pdf') {
                toast.success('PDF importe. Page 1 convertie en image pour le rapport.');
            }

            const dataUrl = await readFileAsDataUrl(normalizedFile);
            setCapturedImage(normalizedFile, {
                dataUrl,
                name: normalizedFile.name,
                type: normalizedFile.type,
                lastModified: normalizedFile.lastModified,
            });
            navigate('/report');
        } catch (err) {
            console.error('Error processing capture file:', err);
            toast.error(getFileConversionErrorMessage(err));
        } finally {
            setProcessingFile(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await handleSelectedFile(file);
        e.target.value = '';
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleSelectedFile(e.dataTransfer.files[0]);
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
            <div className="selected-plan-banner">
                <div className="selected-plan-banner__icon">
                        <Building2 size={20} color="#ffb703" />
                </div>
                <div className="selected-plan-banner__content">
                        <h3>
                            {selectedPlan.siteName}
                        </h3>
                        <p>
                            <MapPin size={12} />
                            {selectedPlan.address || 'Adresse non renseignée'}
                        </p>
                </div>
            </div>

            <div className="card camera">
                <div className="camera__header">
                    <h2>Nouvelle capture terrain</h2>
                    <p>Prenez une photo ou importez un fichier. Si vous quittez la page, le brouillon reste disponible.</p>
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
                    accept="image/*,application/pdf"
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
                    onClick={() => !processingFile && fileInputRef.current?.click()}
                >
                    <div className="dropzone__icon">
                        {processingFile ? <Upload size={28} className="spin" /> : <Camera size={28} />}
                    </div>
                    <p className="dropzone__title">
                        {processingFile ? 'Traitement du fichier en cours...' : 'Deposez un fichier ici ou cliquez pour importer'}
                    </p>
                    <p className="dropzone__hint">Formats JPG, PNG, PDF. Pour un PDF, la page 1 est utilisée.</p>
                </div>

                <div className="camera__actions">
                    <button className="btn btn--primary" onClick={() => cameraInputRef.current?.click()} disabled={processingFile}>
                        <Camera size={18} />
                        Ouvrir la camera
                    </button>
                    <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()} disabled={processingFile}>
                        <Upload size={18} />
                        Importer image/PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
