import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Map, Trash2, ZoomIn, ZoomOut, FileText, Loader2, Upload, Camera } from 'lucide-react';
import { plansApi, ApiPlan, ApiPlanPoint, ApiPlanListItem } from '../services/api';
import { PlanPointForm, PlanPointFormData } from './PlanPointForm';
import { PlanPointDetail } from './PlanPointDetail';
import { generatePlanPDF } from '../services/plan-pdf';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useAuth } from '../contexts/AuthContext';
import { getFileConversionErrorMessage, normalizeFileToImageDataUrl } from '../services/file-conversion';

type SubView = 'LIST' | 'UPLOAD' | 'VIEWER';

const statusBadge: Record<string, string> = {
  a_faire: 'badge--danger',
  en_cours: 'badge--warning',
  termine: 'badge--success',
};

const statusLabels: Record<string, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  termine: 'Termine',
};

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

export const PlanView: React.FC = () => {
  const navigate = useNavigate();
  const { offlineState, getCachedPlans, saveCachedPlan, getAllPlanPointsForPlan, savePlanPointOffline } = useAuth();

  // Sub-views
  const [subView, setSubView] = useState<SubView>('LIST');

  // List
  const [plans, setPlans] = useState<ApiPlanListItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Current plan
  const [currentPlan, setCurrentPlan] = useState<ApiPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Upload
  const [uploadSiteName, setUploadSiteName] = useState('');
  const [uploadAddress, setUploadAddress] = useState('');
  const [uploadImageDataUrl, setUploadImageDataUrl] = useState('');
  const [uploadSourceType, setUploadSourceType] = useState<'image' | 'pdf' | null>(null);
  const [uploadSourceName, setUploadSourceName] = useState('');
  const [processingUpload, setProcessingUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Viewer
  const imageRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Click tracking for distinguishing click vs drag
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // Point modals
  const [showPointForm, setShowPointForm] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ApiPlanPoint | null>(null);
  const [showPointDetail, setShowPointDetail] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ApiPlanPoint | null>(null);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load plans on mount
  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineState.isOnline]);

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      if (offlineState.isOnline) {
        const data = await plansApi.getAll();
        setPlans(data);
      } else {
        const cached = await getCachedPlans();
        setPlans(cached.map((c: any) => ({
          id: c.id,
          siteName: c.siteName,
          address: c.address,
          pointsCount: c.pointsCount,
          createdAt: c.updatedAt,
          updatedAt: c.updatedAt
        })));
      }
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const openPlan = async (planId: string) => {
    setLoadingPlan(true);
    try {
      if (offlineState.isOnline) {
        const plan = await plansApi.getById(planId);

        // Mettre en cache pour usage hors-ligne
        await saveCachedPlan({
          id: plan.id,
          siteName: plan.siteName,
          address: plan.address,
          imageDataUrl: plan.imageDataUrl,
          pointsCount: plan.points.length,
          updatedAt: plan.updatedAt
        });

        // Fusionner avec les points créés localement (hors-ligne)
        const combinedPoints = await getAllPlanPointsForPlan(plan.id, plan.points);
        setCurrentPlan({ ...plan, points: combinedPoints });
      } else {
        const cachedPlans = await getCachedPlans();
        const cached = cachedPlans.find((c: any) => c.id === planId);
        if (!cached) throw new Error('Plan non disponible hors-ligne');

        const localPoints = await getAllPlanPointsForPlan(planId, []);
        setCurrentPlan({
          id: cached.id,
          siteName: cached.siteName,
          address: cached.address,
          imageDataUrl: cached.imageDataUrl,
          pointsCount: localPoints.length,
          points: localPoints,
          createdAt: cached.updatedAt,
          updatedAt: cached.updatedAt
        } as ApiPlan);
      }

      setSubView('VIEWER');
    } catch (err) {
      console.error('Error loading plan:', err);
      toast.error('Erreur lors du chargement du plan. Ce plan est peut-être indisponible hors-ligne.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce plan et tous ses points ?')) return;
    try {
      await plansApi.deletePlan(planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      console.error('Error deleting plan:', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  // Upload handlers
  const handleUploadFile = async (file: File) => {
    try {
      setProcessingUpload(true);
      const { dataUrl, sourceType } = await normalizeFileToImageDataUrl(file, {
        maxWidth: 2200,
        maxHeight: 2200,
        quality: 0.85,
      });

      setUploadImageDataUrl(dataUrl);
      setUploadSourceType(sourceType);
      setUploadSourceName(file.name);

      if (sourceType === 'pdf') {
        toast.success('PDF importe. Page 1 utilisee comme plan.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      toast.error(getFileConversionErrorMessage(err));
    } finally {
      setProcessingUpload(false);
    }
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadSiteName.trim() || !uploadImageDataUrl) return;
    setUploading(true);
    try {
      const plan = await plansApi.create({
        siteName: uploadSiteName.trim(),
        address: uploadAddress.trim() || undefined,
        imageDataUrl: uploadImageDataUrl,
      });
      setCurrentPlan(plan);
      setSubView('VIEWER');
      // Reset upload form
      setUploadSiteName('');
      setUploadAddress('');
      setUploadImageDataUrl('');
      setUploadSourceType(null);
      setUploadSourceName('');
    } catch (err) {
      console.error('Error creating plan:', err);
      toast.error('Erreur lors de la creation du plan.');
    } finally {
      setUploading(false);
    }
  };

  // Viewer: click on plan to add point
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Distinguish click from drag
    if (mouseDownPos.current) {
      const dx = Math.abs(e.clientX - mouseDownPos.current.x);
      const dy = Math.abs(e.clientY - mouseDownPos.current.y);
      if (dx > 5 || dy > 5) return; // was a drag
    }

    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp to valid range
    if (posX < 0 || posX > 100 || posY < 0 || posY > 100) return;

    setClickPosition({ x: posX, y: posY });
    setEditingPoint(null);
    setShowPointForm(true);
  }, []);

  const handleMarkerClick = (point: ApiPlanPoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPoint(point);
    setShowPointDetail(true);
  };

  // Point CRUD
  const handleSavePoint = async (data: PlanPointFormData) => {
    if (!currentPlan) return;

    if (editingPoint) {
      // Update (requires online for now, simplified)
      if (!offlineState.isOnline && !editingPoint.id.startsWith('local-')) {
        toast.error("L'edition de points existants n'est pas encore disponible hors-ligne.");
        return;
      }
      try {
        const updated = await plansApi.updatePoint(currentPlan.id, editingPoint.id, data);
        setCurrentPlan((prev: ApiPlan | null) =>
          prev ? { ...prev, points: prev.points.map((p: ApiPlanPoint) => (p.id === updated.id ? updated : p)) } : null
        );
        setShowPointForm(false);
        setEditingPoint(null);
        setShowPointDetail(false);
      } catch (err) {
        console.error('Error updating point:', err);
        toast.error('Erreur lors de la mise a jour.');
      }
    } else if (clickPosition) {
      // Create
      try {
        if (offlineState.isOnline) {
          const newPoint = await plansApi.addPoint(currentPlan.id, {
            positionX: clickPosition.x,
            positionY: clickPosition.y,
            ...data,
          });
          setCurrentPlan((prev: ApiPlan | null) =>
            prev ? { ...prev, points: [...prev.points, newPoint] } : null
          );
        } else {
          // Hors-Ligne
          const pointPayload = {
            positionX: clickPosition.x,
            positionY: clickPosition.y,
            ...data,
          };
          const localId = await savePlanPointOffline(currentPlan.id, pointPayload);

          // Generate a fake point for UI
          const maxPointNumber = currentPlan.points.length > 0
            ? Math.max(...currentPlan.points.map(p => p.pointNumber || 0))
            : 0;

          const localPoint: ApiPlanPoint = {
            id: localId,
            planId: currentPlan.id,
            pointNumber: maxPointNumber + 1,
            ...pointPayload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as ApiPlanPoint;

          setCurrentPlan((prev: ApiPlan | null) =>
            prev ? { ...prev, points: [...prev.points, localPoint] } : null
          );
        }
        setShowPointForm(false);
        setClickPosition(null);
      } catch (err) {
        console.error('Error creating point:', err);
        toast.error('Erreur lors de la creation du point.');
      }
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!currentPlan) return;
    try {
      await plansApi.deletePoint(currentPlan.id, pointId);
      setCurrentPlan((prev: ApiPlan | null) =>
        prev ? { ...prev, points: prev.points.filter((p: ApiPlanPoint) => p.id !== pointId) } : null
      );
      setShowPointDetail(false);
      setSelectedPoint(null);
    } catch (err) {
      console.error('Error deleting point:', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleEditFromDetail = () => {
    if (!selectedPoint) return;
    setEditingPoint(selectedPoint);
    setShowPointDetail(false);
    setShowPointForm(true);
  };

  // PDF
  const handleGeneratePdf = async () => {
    if (!currentPlan) return;
    setGeneratingPdf(true);
    try {
      await generatePlanPDF(currentPlan);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Erreur lors de la generation du PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Back navigation
  const handleBackFromViewer = () => {
    setCurrentPlan(null);
    setSubView('LIST');
    loadPlans();
  };

  // === RENDER ===

  // LIST view
  if (subView === 'LIST') {
    return (
      <div className="view">
        <div className="view__top">
          <button onClick={() => navigate('/')} className="link-btn">
            <ArrowLeft size={16} /> Accueil
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Map size={22} /> Plans & Points
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                {plans.length} plan(s) enregistre(s)
              </p>
            </div>
            <button className="btn btn--primary" onClick={() => setSubView('UPLOAD')}>
              <Plus size={16} /> Nouveau plan
            </button>
          </div>

          {loadingPlans ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 size={24} className="spin" />
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Chargement...</p>
            </div>
          ) : plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Map size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>Aucun plan pour le moment.</p>
              <p style={{ fontSize: '0.85rem' }}>Cliquez sur "Nouveau plan" pour commencer.</p>
            </div>
          ) : (
            <div className="plan-list">
              {plans.map((plan) => (
                <div key={plan.id} className="plan-card" onClick={() => openPlan(plan.id)}>
                  <div className="plan-card__info">
                    <span className="plan-card__name">{plan.siteName}</span>
                    <span className="plan-card__meta">
                      {plan.address && `${plan.address} · `}
                      {new Date(plan.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="plan-card__badge">
                    <span className="badge badge--info">{plan.pointsCount} point(s)</span>
                    <button
                      className="btn btn--ghost"
                      onClick={(e) => handleDeletePlan(plan.id, e)}
                      style={{ color: 'var(--danger)', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loadingPlan && (
          <div className="modal-overlay">
            <div style={{ textAlign: 'center', color: 'white' }}>
              <Loader2 size={32} className="spin" />
              <p style={{ marginTop: '12px' }}>Chargement du plan...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // UPLOAD view
  if (subView === 'UPLOAD') {
    return (
      <div className="view">
        <div className="view__top">
          <button onClick={() => setSubView('LIST')} className="link-btn">
            <ArrowLeft size={16} /> Retour
          </button>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> Nouveau plan
          </h2>

          <div className="plan-upload">
            {/* Plan image */}
            <div className="form-field">
              <label>Plan (image ou PDF) *</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                ref={uploadInputRef}
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    await handleUploadFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              {processingUpload ? (
                <div className="dropzone dropzone--active" style={{ cursor: 'default' }}>
                  <div className="dropzone__icon"><Loader2 size={28} className="spin" /></div>
                  <p className="dropzone__title">Traitement du fichier en cours...</p>
                  <p className="dropzone__hint">Conversion optimisee pour affichage sur plan</p>
                </div>
              ) : uploadImageDataUrl ? (
                <div>
                  <div className="plan-upload__preview">
                    <img src={uploadImageDataUrl} alt="Preview" />
                  </div>
                  {uploadSourceType === 'pdf' && (
                    <p className="detail-sub" style={{ marginTop: '8px' }}>
                      PDF detecte: seule la page 1 est utilisee comme fond de plan.
                    </p>
                  )}
                  {uploadSourceName && (
                    <p className="detail-sub" style={{ marginTop: '4px' }}>
                      Fichier: {uploadSourceName}
                    </p>
                  )}
                  <button
                    className="btn btn--ghost"
                    onClick={() => uploadInputRef.current?.click()}
                    style={{ marginTop: '8px', width: '100%' }}
                  >
                    <Camera size={16} /> Changer le fichier
                  </button>
                </div>
              ) : (
                <div
                  className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleUploadDrop}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <div className="dropzone__icon"><Upload size={28} /></div>
                  <p className="dropzone__title">Deposez le plan ou cliquez pour importer</p>
                  <p className="dropzone__hint">Formats JPG, PNG, PDF</p>
                </div>
              )}
            </div>

            {/* Site name */}
            <div className="form-field">
              <label>Nom du chantier *</label>
              <input
                type="text"
                className="input"
                value={uploadSiteName}
                onChange={(e) => setUploadSiteName(e.target.value)}
                placeholder="Ex: Residence Les Cerisiers"
              />
            </div>

            {/* Address */}
            <div className="form-field">
              <label>Adresse</label>
              <input
                type="text"
                className="input"
                value={uploadAddress}
                onChange={(e) => setUploadAddress(e.target.value)}
                placeholder="Ex: 12 rue des Lilas, 75001 Paris"
              />
            </div>

            <button
              className="btn btn--primary"
              onClick={handleUploadSubmit}
              disabled={!uploadSiteName.trim() || !uploadImageDataUrl || uploading || processingUpload}
              style={{ width: '100%' }}
            >
              {uploading ? <><Loader2 size={16} className="spin" /> Creation...</> : processingUpload ? 'Traitement du fichier...' : 'Creer le plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEWER view
  if (subView === 'VIEWER' && currentPlan) {
    return (
      <div className="view">
        <div className="view__top">
          <button onClick={handleBackFromViewer} className="link-btn">
            <ArrowLeft size={16} /> Mes plans
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn--primary"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <><Loader2 size={16} className="spin" /> Generation...</>
              ) : (
                <><FileText size={16} /> Generer Rapport PDF</>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          {/* Plan header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentPlan.siteName}</h2>
              {currentPlan.address && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>{currentPlan.address}</p>
              )}
            </div>
            <span className="badge badge--info">{currentPlan.points.length} point(s)</span>
          </div>

          {/* Plan viewer */}
          <div className="plan-viewer" ref={viewerRef} style={{ padding: 0, overflow: 'hidden' }}>
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, centerView }) => (
                <>
                  {/* Zoom controls overlay */}
                  <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px', zIndex: 20 }}>
                    <button className="btn btn--ghost" onClick={() => zoomIn()} title="Zoom +">
                      <ZoomIn size={18} />
                    </button>
                    <button className="btn btn--ghost" onClick={() => zoomOut()} title="Zoom -">
                      <ZoomOut size={18} />
                    </button>
                    <button className="btn btn--ghost" onClick={() => centerView()} title="Centrer">
                      <Map size={18} />
                    </button>
                  </div>

                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <div
                      className="plan-viewer__canvas"
                      onMouseDown={handleCanvasMouseDown}
                      onClick={handleCanvasClick}
                      style={{ position: 'relative' }}
                    >
                      <img
                        ref={imageRef}
                        src={currentPlan.imageDataUrl}
                        alt="Plan"
                        className="plan-viewer__image"
                        draggable={false}
                        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                      />

                      {/* Point markers */}
                      {currentPlan.points.map((point) => (
                        <div
                          key={point.id}
                          className={`plan-marker plan-marker--${point.status}`}
                          style={{
                            left: `${point.positionX}%`,
                            top: `${point.positionY}%`,
                          }}
                          onClick={(e) => handleMarkerClick(point, e)}
                          title={`#${point.pointNumber} ${point.title}`}
                        >
                          {point.pointNumber}
                        </div>
                      ))}
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
            Cliquez sur le plan pour ajouter un point
          </p>

          {/* Points list */}
          {currentPlan.points.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                Points d'inspection ({currentPlan.points.length})
              </h3>
              <div className="plan-points-list">
                {[...currentPlan.points]
                  .sort((a, b) => a.pointNumber - b.pointNumber)
                  .map((point) => (
                    <div
                      key={point.id}
                      className="plan-points-list__item"
                      onClick={() => {
                        setSelectedPoint(point);
                        setShowPointDetail(true);
                      }}
                    >
                      <div
                        className="plan-points-list__number"
                        style={{
                          background:
                            point.status === 'termine'
                              ? 'var(--success)'
                              : point.status === 'en_cours'
                                ? 'var(--warning)'
                                : 'var(--danger)',
                        }}
                      >
                        {point.pointNumber}
                      </div>
                      <div className="plan-points-list__content">
                        <div className="plan-points-list__title">{point.title}</div>
                        <div className="plan-points-list__badges">
                          <span className="badge badge--info" style={{ fontSize: '0.7rem' }}>
                            {categoryLabels[point.category] || point.category}
                          </span>
                          <span className={`badge ${statusBadge[point.status]}`} style={{ fontSize: '0.7rem' }}>
                            {statusLabels[point.status]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {showPointForm && (
          <PlanPointForm
            onSave={handleSavePoint}
            onClose={() => {
              setShowPointForm(false);
              setClickPosition(null);
              setEditingPoint(null);
            }}
            initialData={editingPoint ? {
              title: editingPoint.title,
              description: editingPoint.description || '',
              category: editingPoint.category,
              photoDataUrl: editingPoint.photoDataUrl,
              dateLabel: editingPoint.dateLabel,
              room: editingPoint.room || '',
              status: editingPoint.status,
            } : undefined}
            isEdit={!!editingPoint}
          />
        )}

        {showPointDetail && selectedPoint && (
          <PlanPointDetail
            point={selectedPoint}
            onClose={() => {
              setShowPointDetail(false);
              setSelectedPoint(null);
            }}
            onEdit={handleEditFromDetail}
            onDelete={() => handleDeletePoint(selectedPoint.id)}
          />
        )}
      </div>
    );
  }

  return null;
};
