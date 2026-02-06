import React, { useEffect, useMemo, useState } from 'react';
import { Download, MapPin, Loader2, ArrowLeft, FileText, Shield, Share2, Mic, Building2 } from 'lucide-react';
import { generateDescription } from '../services/ai';
import { getAddress, getLocation, LocationData } from '../services/geo';
import { generatePremiumPDF } from '../services/pdf-premium';
import { useAuth } from '../contexts/AuthContext';
import { reportsApi, ApiPlan } from '../services/api';
import { generateIntegrityProof, type IntegrityProof, generateCertificateText } from '../services/crypto';
import { ExtraWorkManager, type ExtraWorkItem } from './ExtraWork';
import { ShareReportModal } from './ShareReport';
import { VoiceRecorderComponent } from './VoiceRecorder';
import { branding } from '../config/branding';

interface ReportViewProps {
    imageFile: File;
    selectedPlan: ApiPlan;
    onBack: () => void;
    onReset: () => void;
}

type ReportData = {
    dateLabel: string;
    address: string;
    coordinates: string;
    accuracy: number | null;
    locationSource: LocationData['source'];
    reportId: string;
    createdAt: string;
};

const analysisSteps = [
    'Lecture des metadonnees',
    'Localisation GPS',
    'Analyse IA',
    'Mise en page du rapport',
];

const loadImageElement = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Impossible de lire l\'image'));
        };
        image.src = url;
    });

const fileToDataUrl = async (
    file: File,
    options: { maxWidth: number; maxHeight: number; quality: number }
) => {
    try {
        const image = await loadImageElement(file);
        const scale = Math.min(
            1,
            options.maxWidth / image.width,
            options.maxHeight / image.height
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas indisponible');
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', options.quality);
    } catch (err) {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Impossible de lire l\'image'));
            reader.readAsDataURL(file);
        });
    }
};

const formatCoordinate = (value: number | null, positive: string, negative: string) => {
    if (value === null || Number.isNaN(value)) {
        return '--';
    }
    const label = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(5)} ${label}`;
};

const formatReportId = (date: Date) => {
    const pad = (value: number) => `${value}`.padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const random = `${Math.floor(Math.random() * 1000)}`.padStart(3, '0');
    return `SF-${stamp}-${time}-${random}`;
};

export const ReportView: React.FC<ReportViewProps> = ({ imageFile, selectedPlan, onBack, onReset }) => {
    const { refreshReports, saveReportOffline } = useAuth();
    const [analyzing, setAnalyzing] = useState(true);
    const [analysisStage, setAnalysisStage] = useState(0);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [description, setDescription] = useState('');
    const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'done'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    
    // Pilier 2: Intégrité
    const [integrityProof, setIntegrityProof] = useState<IntegrityProof | null>(null);
    
    // Pilier 1: Travaux Supp
    const [extraWorks, setExtraWorks] = useState<ExtraWorkItem[]>([]);
    const [clientSignature, setClientSignature] = useState<string>('');
    
    // Pilier 4: Partage
    const [showShare, setShowShare] = useState(false);
    
    // Pilier 3: Dictaphone
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    
    // Champs métier - pré-remplis avec les infos du plan
    const [siteName, setSiteName] = useState(selectedPlan.siteName || '');
    const [operatorName, setOperatorName] = useState('');
    const [clientName, setClientName] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [category, setCategory] = useState<'safety' | 'progress' | 'anomaly' | 'other'>('other');

    const progress = useMemo(() => {
        if (!analyzing) {
            return 100;
        }
        const raw = Math.round((analysisStage / analysisSteps.length) * 100);
        return Math.min(90, raw);
    }, [analysisStage, analyzing]);

    useEffect(() => {
        let active = true;
        const url = URL.createObjectURL(imageFile);
        setImageUrl(url);
        setAnalyzing(true);
        setAnalysisStage(0);
        setDownloadState('idle');
        setError(null);
        setInfoMessage(null);

        const timers = analysisSteps.map((_, index) =>
            setTimeout(() => {
                if (active) {
                    setAnalysisStage(index + 1);
                }
            }, 600 * (index + 1))
        );

        const run = async () => {
            try {
                const [location, aiDescription] = await Promise.all([
                    getLocation(),
                    generateDescription(imageFile),
                ]);
                const address = await getAddress(location.lat, location.lng, location.source);
                const now = new Date();
                const dateLabel = new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                }).format(now);
                const coordinates =
                    location.lat === null || location.lng === null
                        ? 'Non capturees'
                        : `${formatCoordinate(location.lat, 'N', 'S')} · ${formatCoordinate(
                              location.lng,
                              'E',
                              'W'
                          )}`;

                if (!active) {
                    return;
                }

                const reportId = formatReportId(now);

                setReportData({
                    dateLabel,
                    address,
                    coordinates,
                    accuracy: location.accuracy ?? null,
                    locationSource: location.source,
                    reportId,
                    createdAt: now.toISOString(),
                });
                setDescription(aiDescription);

                // Pilier 2: Générer preuve d'intégrité
                const imageData = await fileToDataUrl(imageFile, {
                    maxWidth: 800,
                    maxHeight: 600,
                    quality: 0.7,
                });
                const proof = await generateIntegrityProof(imageData, reportId, coordinates);
                setIntegrityProof(proof);

                setAnalyzing(false);
                setAnalysisStage(analysisSteps.length);
            } catch (err) {
                if (!active) {
                    return;
                }
                setReportData({
                    dateLabel: new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'full',
                        timeStyle: 'short',
                    }).format(new Date()),
                    address: 'Localisation non capturee',
                    coordinates: 'Non capturees',
                    accuracy: null,
                    locationSource: 'unavailable',
                    reportId: formatReportId(new Date()),
                    createdAt: new Date().toISOString(),
                });
                setDescription('Description indisponible. Ajoutez vos notes manuellement.');
                setError('Analyse incomplete. Vous pouvez tout de meme generer un PDF.');
                setAnalyzing(false);
            }
        };

        run();

        return () => {
            active = false;
            URL.revokeObjectURL(url);
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [imageFile]);

    const handleDownload = async () => {
        if (!reportData || downloadState === 'loading') {
            return;
        }
        setDownloadState('loading');
        setError(null);
        setInfoMessage(null);

        try {
            const imageDataUrl = await fileToDataUrl(imageFile, {
                maxWidth: 1800,
                maxHeight: 1200,
                quality: 0.82,
            });
            
            // Ajouter description des TS et certificat d'intégrité
            let finalDescription = description;
            if (extraWorks.length > 0) {
                const tsList = extraWorks.map(ts => 
                    `- ${ts.description} (${ts.estimatedCost}€ HT) [${ts.category}]`
                ).join('\n');
                finalDescription += '\n\n--- TRAVAUX SUPPLEMENTAIRES ---\n' + tsList;
                finalDescription += `\n\nTOTAL TS: ${extraWorks.reduce((s, t) => s + t.estimatedCost, 0)}€ HT`;
                if (clientSignature) {
                    finalDescription += '\n\nSignature client: OUI';
                }
            }
            
            if (integrityProof) {
                finalDescription += '\n\n--- CERTIFICATION ---\n' + generateCertificateText(integrityProof);
            }
            
            // Préparer les données du rapport
            const reportPayload = {
                reportId: reportData.reportId,
                dateLabel: reportData.dateLabel,
                address: reportData.address,
                coordinates: reportData.coordinates,
                accuracy: reportData.accuracy,
                locationSource: reportData.locationSource,
                description: finalDescription,
                imageDataUrl,
                siteName: siteName || undefined,
                operatorName: operatorName || undefined,
                clientName: clientName || undefined,
                priority,
                category,
                integrityHash: integrityProof?.hash,
                clientSignature: clientSignature || undefined,
                planId: selectedPlan.id, // Lien vers le plan
                extraWorks: extraWorks.map(w => ({
                    description: w.description,
                    estimatedCost: w.estimatedCost,
                    urgency: w.urgency,
                    category: w.category
                }))
            };

            // Essayer de sauvegarder sur le serveur
            try {
                await reportsApi.create(reportPayload);
                // Succès serveur → rafraîchir la liste
                await refreshReports();
            } catch (err: any) {
                // Si erreur réseau ou serveur, sauvegarder localement
                console.log('Sauvegarde serveur échouée, mode offline activé');
                await saveReportOffline(reportPayload); // ← Appelle déjà refreshReports()
                // Afficher un message de succès (pas une erreur)
                setInfoMessage('📱 Rapport sauvegardé localement. Il sera synchronisé quand le réseau reviendra.');
            }
            
            // Générer le PDF
            await generatePremiumPDF({
                imageDataUrl,
                address: reportData.address,
                description: finalDescription,
                date: reportData.dateLabel,
                coordinates: reportData.coordinates,
                accuracy: reportData.accuracy,
                locationSource: reportData.locationSource,
                reportId: reportData.reportId,
                companyName: branding.companyName,
                reportTitle: branding.reportTitle,
                productName: branding.productName,
                logoUrl: branding.logoUrl,
                siteName,
                operatorName,
                clientName,
                priority,
                category,
                integrityHash: integrityProof?.hash,
                extraWorks,
                clientSignature,
            });
            setDownloadState('done');
        } catch (err) {
            setError('Impossible de generer le PDF. Reessayez.');
            setDownloadState('idle');
        }
    };

    // Pilier 1: Gestion des TS
    const handleAddExtraWork = (item: Omit<ExtraWorkItem, 'id' | 'createdAt'>) => {
        const newItem: ExtraWorkItem = {
            ...item,
            id: 'TS-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            createdAt: new Date().toISOString(),
        };
        setExtraWorks(prev => [...prev, newItem]);
    };

    const handleRemoveExtraWork = (id: string) => {
        setExtraWorks(prev => prev.filter(item => item.id !== id));
    };

    const locationStatus = (() => {
        if (!reportData) {
            return {
                badge: 'Signal inconnu',
                badgeClass: 'badge--warning',
                hint: 'Localisation indisponible.',
            };
        }
        if (reportData.locationSource === 'gps') {
            return {
                badge: 'GPS OK',
                badgeClass: 'badge--success',
                hint: 'Position GPS capturee sur site.',
            };
        }
        if (reportData.locationSource === 'demo') {
            return {
                badge: 'Mode demo',
                badgeClass: 'badge--warning',
                hint: 'Coordonnees de demonstration. Activez le GPS pour un rapport officiel.',
            };
        }
        return {
            badge: 'GPS indisponible',
            badgeClass: 'badge--warning',
            hint: 'Activez la geolocalisation pour un rapport certifie.',
        };
    })();

    const accuracyLabel =
        reportData?.accuracy !== null && reportData?.accuracy !== undefined
            ? `Precision ± ${Math.round(reportData.accuracy)} m`
            : 'Precision non disponible';

    if (analyzing) {
        return (
            <div className="view">
                <div className="view__top">
                    <button onClick={onReset} className="link-btn">
                        <ArrowLeft size={16} /> Annuler
                    </button>
                    <div className="stepper">
                        <span className="stepper__item">1 Capture</span>
                        <span className="stepper__item stepper__item--active">2 Analyse</span>
                        <span className="stepper__item">3 PDF</span>
                    </div>
                </div>

                <div className="card analysis">
                    <div className="analysis__icon">
                        <Loader2 size={32} className="spin" />
                    </div>
                    <h2 className="analysis__title">Analyse en cours</h2>
                    <p className="analysis__copy">
                        Extraction GPS, horodatage et description intelligente en temps reel.
                    </p>
                    <div className="progress">
                        <div className="progress__bar" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="analysis__steps">
                        {analysisSteps.map((step, index) => (
                            <div
                                key={step}
                                className={`analysis-step ${index < analysisStage ? 'analysis-step--done' : ''}`}
                            >
                                <span className="analysis-step__dot" />
                                {step}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="view">
            <div className="view__top">
                <button onClick={onReset} className="link-btn">
                    <ArrowLeft size={16} /> Nouveau rapport
                </button>
                <div className="stepper">
                    <span className="stepper__item">1. Chantier</span>
                    <span className="stepper__item">2. Photos</span>
                    <span className="stepper__item stepper__item--active">3. Rapport</span>
                </div>
            </div>

            {/* Info du chantier */}
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

            <section className="card report">
                <div className="report__header">
                    <div>
                        <h2>Rapport pret a exporter</h2>
                        <p>Verifiez la description puis telechargez le PDF professionnel.</p>
                        <p className="detail-sub">ID Rapport: {reportData?.reportId}</p>
                        {error && <p className="detail-sub" style={{ color: '#ff6b6b' }}>{error}</p>}
                        {infoMessage && <p className="detail-sub" style={{ color: '#7cfc8a' }}>{infoMessage}</p>}
                    </div>
                    <div className="report__actions">
                        {/* Pilier 2: Badge intégrité */}
                        {integrityProof && (
                            <span className="badge badge--success" title={`Hash: ${integrityProof.hash.substring(0, 16)}...`}>
                                <Shield size={12} /> Certifie
                            </span>
                        )}
                        <button className="btn btn--ghost" onClick={onBack}>
                            <FileText size={18} />
                            Reprendre la photo
                        </button>
                        {/* Pilier 4: Bouton partage */}
                        <button className="btn btn--ghost" onClick={() => setShowShare(true)}>
                            <Share2 size={18} />
                            Partager
                        </button>
                        <button
                            className="btn btn--primary"
                            onClick={handleDownload}
                            disabled={downloadState === 'loading'}
                        >
                            {downloadState === 'loading' ? (
                                <>
                                    <Loader2 size={18} className="spin" />
                                    Generation PDF...
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    {downloadState === 'done' ? 'PDF genere' : 'Telecharger le PDF'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="report__body">
                    <div className="report__media">
                        <img src={imageUrl} alt="Capture chantier" />
                        <div className="report__coords">
                            <span className="chip">
                                <MapPin size={12} /> {reportData?.coordinates}
                            </span>
                            <span className="chip">{accuracyLabel}</span>
                        </div>
                    </div>

                    <div className="detail-grid">
                        <div className="detail-card">
                            <span className="detail-label">Horodatage</span>
                            <span className="detail-value">{reportData?.dateLabel}</span>
                        </div>
                        <div className="detail-card">
                            <span className="detail-label">Localisation</span>
                            <span className="detail-value">{reportData?.address}</span>
                            <span className="detail-sub">{reportData?.coordinates}</span>
                        </div>
                        
                        {/* Formulaire métier */}
                        <div className="detail-card detail-card--wide">
                            <span className="detail-label">Informations chantier</span>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label>Nom du chantier</label>
                                    <input 
                                        type="text" 
                                        className="input"
                                        value={siteName}
                                        onChange={(e) => setSiteName(e.target.value)}
                                        placeholder="Ex: Construction Bâtiment A"
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Operateur</label>
                                    <input 
                                        type="text" 
                                        className="input"
                                        value={operatorName}
                                        onChange={(e) => setOperatorName(e.target.value)}
                                        placeholder="Nom de l'operateur"
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Client</label>
                                    <input 
                                        type="text" 
                                        className="input"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="Nom du client"
                                    />
                                </div>
                                <div className="form-field form-field--row">
                                    <div className="form-field">
                                        <label>Priorite</label>
                                        <select 
                                            className="input select"
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                        >
                                            <option value="low">Basse</option>
                                            <option value="medium">Moyenne</option>
                                            <option value="high">Haute</option>
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label>Categorie</label>
                                        <select 
                                            className="input select"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as 'safety' | 'progress' | 'anomaly' | 'other')}
                                        >
                                            <option value="safety">Securite</option>
                                            <option value="progress">Avancement</option>
                                            <option value="anomaly">Anomalie</option>
                                            <option value="other">Autre</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pilier 3: Dictaphone */}
                        <div className="detail-card detail-card--wide">
                            <div className="detail-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Description</span>
                                <button 
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                                >
                                    <Mic size={14} />
                                    {showVoiceRecorder ? 'Fermer' : 'Dicter'}
                                </button>
                            </div>
                            
                            {showVoiceRecorder && (
                                <VoiceRecorderComponent 
                                    onTranscription={(text) => {
                                        setDescription(prev => prev + (prev ? '\n\n' : '') + text);
                                    }}
                                    existingText={description}
                                />
                            )}
                            
                            <textarea
                                className="textarea"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Décrivez les observations..."
                            />
                        </div>
                        
                        {/* Pilier 1: Travaux Supplémentaires */}
                        <div className="detail-card detail-card--wide">
                            <ExtraWorkManager
                                items={extraWorks}
                                onAdd={handleAddExtraWork}
                                onRemove={handleRemoveExtraWork}
                                onSignature={setClientSignature}
                                signature={clientSignature}
                            />
                        </div>

                        <div className="detail-card detail-card--wide">
                            <span className="detail-label">Etat du signal</span>
                            <div className="detail-value">
                                <span className={`badge ${locationStatus.badgeClass}`}>
                                    {locationStatus.badge}
                                </span>
                            </div>
                            <span className="detail-sub">{locationStatus.hint}</span>
                        </div>

                        {/* Pilier 2: Preuve d'intégrité */}
                        {integrityProof && (
                            <div className="detail-card detail-card--wide integrity-card">
                                <span className="detail-label">
                                    <Shield size={12} /> Preuve d'intégrité (Blockchain locale)
                                </span>
                                <div className="integrity-hash">
                                    <code>{integrityProof.hash}</code>
                                </div>
                                <p className="detail-sub">
                                    Ce rapport est protégé contre toute altération. Hash SHA-256 généré à {new Date(integrityProof.timestamp).toLocaleTimeString('fr-FR')}.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Modal: Partage */}
            {showShare && reportData && (
                <ShareReportModal
                    reportId={reportData.reportId}
                    siteName={siteName}
                    onClose={() => setShowShare(false)}
                />
            )}
        </div>
    );
};
