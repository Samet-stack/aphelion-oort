import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Map, Trash2, ZoomIn, ZoomOut, FileText, Loader2, Upload, Camera, ChevronRight } from 'lucide-react';
import { plansApi, ApiPlan, ApiPlanPoint, ApiPlanListItem } from '../services/api';
import { PlanPointFormData } from './PlanPointForm';
import { PlanPointPanel } from './PlanPointPanel';
import { generatePlanPDFPremium as generatePlanPDF } from '../services/plan-pdf-premium';

interface PlanViewProps {
  onBack: () => void;
}

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

const fileToDataUrl = (file: File, maxW = 2000, maxH = 2000, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const PlanView: React.FC<PlanViewProps> = ({ onBack }) => {
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
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Viewer
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Click tracking for distinguishing click vs drag
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // Side panel
  type PanelMode = 'closed' | 'detail' | 'edit' | 'create';
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ApiPlanPoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<ApiPlanPoint | null>(null);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const data = await plansApi.getAll();
      setPlans(data);
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const openPlan = async (planId: string) => {
    setLoadingPlan(true);
    try {
      const plan = await plansApi.getById(planId);
      setCurrentPlan(plan);
      setSubView('VIEWER');
      setZoom(1);
    } catch (err) {
      console.error('Error loading plan:', err);
      alert('Erreur lors du chargement du plan.');
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
      alert('Erreur lors de la suppression.');
    }
  };

  // Upload handlers
  const handleUploadFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setUploadImageDataUrl(dataUrl);
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
      setZoom(1);
      // Reset upload form
      setUploadSiteName('');
      setUploadAddress('');
      setUploadImageDataUrl('');
    } catch (err) {
      console.error('Error creating plan:', err);
      alert('Erreur lors de la creation du plan.');
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
    setSelectedPoint(null);
    setPanelMode('create');
  }, []);

  const handleMarkerClick = (point: ApiPlanPoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPoint(point);
    setEditingPoint(null);
    setPanelMode('detail');
  };

  // Point CRUD
  const handleSavePoint = async (data: PlanPointFormData) => {
    if (!currentPlan) return;

    if (editingPoint) {
      // Update
      try {
        const updated = await plansApi.updatePoint(currentPlan.id, editingPoint.id, data);
        setCurrentPlan((prev) =>
          prev ? { ...prev, points: prev.points.map((p) => (p.id === updated.id ? updated : p)) } : null
        );
        setSelectedPoint(updated);
        setEditingPoint(null);
        setPanelMode('detail');
      } catch (err) {
        console.error('Error updating point:', err);
        alert('Erreur lors de la mise a jour.');
      }
    } else if (clickPosition) {
      // Create
      try {
        const newPoint = await plansApi.addPoint(currentPlan.id, {
          positionX: clickPosition.x,
          positionY: clickPosition.y,
          ...data,
        });
        setCurrentPlan((prev) =>
          prev ? { ...prev, points: [...prev.points, newPoint] } : null
        );
        setSelectedPoint(newPoint);
        setPanelMode('detail');
        setClickPosition(null);
      } catch (err) {
        console.error('Error creating point:', err);
        alert('Erreur lors de la creation du point.');
      }
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!currentPlan) return;
    try {
      await plansApi.deletePoint(currentPlan.id, pointId);
      setCurrentPlan((prev) =>
        prev ? { ...prev, points: prev.points.filter((p) => p.id !== pointId) } : null
      );
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
    } catch (err) {
      console.error('Error deleting point:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const handleEditFromDetail = () => {
    if (!selectedPoint) return;
    setEditingPoint(selectedPoint);
    setPanelMode('edit');
  };

  const handlePanelClose = () => {
    setPanelMode('closed');
    setSelectedPoint(null);
    setEditingPoint(null);
    setClickPosition(null);
  };

  const handleNavigatePoint = (point: ApiPlanPoint) => {
    setSelectedPoint(point);
    setEditingPoint(null);
    setPanelMode('detail');
  };

  // PDF
  const handleGeneratePdf = async () => {
    if (!currentPlan) return;
    setGeneratingPdf(true);
    try {
      const { blob, filename } = await generatePlanPDF(currentPlan);
      const blobUrl = URL.createObjectURL(blob);
      const newTab = window.open(blobUrl, '_blank');
      if (!newTab) {
        // Fallback download if popup blocked
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Erreur lors de la generation du PDF.');
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
          <button onClick={onBack} className="link-btn">
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
              <label>Image du plan *</label>
              <input
                type="file"
                accept="image/*"
                ref={uploadInputRef}
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    await handleUploadFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              {uploadImageDataUrl ? (
                <div>
                  <div className="plan-upload__preview">
                    <img src={uploadImageDataUrl} alt="Preview" />
                  </div>
                  <button
                    className="btn btn--ghost"
                    onClick={() => uploadInputRef.current?.click()}
                    style={{ marginTop: '8px', width: '100%' }}
                  >
                    <Camera size={16} /> Changer l'image
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
                  <p className="dropzone__hint">Formats JPG, PNG</p>
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
              disabled={!uploadSiteName.trim() || !uploadImageDataUrl || uploading}
              style={{ width: '100%' }}
            >
              {uploading ? <><Loader2 size={16} className="spin" /> Creation...</> : 'Creer le plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEWER view
  if (subView === 'VIEWER' && currentPlan) {
    const isPanelOpen = panelMode !== 'closed';

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

        <div className={`plan-viewer-layout ${isPanelOpen ? 'plan-viewer-layout--open' : ''}`}>
          <div className="plan-viewer-layout__main">
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
              <div className="plan-viewer" ref={viewerRef}>
                {/* Zoom controls */}
                <div className="plan-viewer__controls">
                  <button className="btn btn--ghost" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} title="Zoom +">
                    <ZoomIn size={18} />
                  </button>
                  <button className="btn btn--ghost" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} title="Zoom -">
                    <ZoomOut size={18} />
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <div
                  className="plan-viewer__canvas"
                  style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}
                  onMouseDown={handleCanvasMouseDown}
                  onClick={handleCanvasClick}
                >
                  <img
                    ref={imageRef}
                    src={currentPlan.imageDataUrl}
                    alt="Plan"
                    className="plan-viewer__image"
                    draggable={false}
                  />

                  {/* Point markers */}
                  {currentPlan.points.map((pt) => (
                    <div
                      key={pt.id}
                      className={`plan-marker plan-marker--${pt.status}${selectedPoint?.id === pt.id && isPanelOpen ? ' plan-marker--active' : ''}`}
                      style={{
                        left: `${pt.positionX}%`,
                        top: `${pt.positionY}%`,
                      }}
                      onClick={(e) => handleMarkerClick(pt, e)}
                      title={`#${pt.pointNumber} ${pt.title}`}
                    >
                      {pt.pointNumber}
                    </div>
                  ))}
                </div>
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
                      .map((pt) => (
                        <div
                          key={pt.id}
                          className={`plan-points-list__item${selectedPoint?.id === pt.id && isPanelOpen ? ' plan-points-list__item--active' : ''}`}
                          onClick={() => {
                            setSelectedPoint(pt);
                            setEditingPoint(null);
                            setPanelMode('detail');
                          }}
                        >
                          <div
                            className="plan-points-list__number"
                            style={{
                              background:
                                pt.status === 'termine'
                                  ? 'var(--success)'
                                  : pt.status === 'en_cours'
                                    ? 'var(--warning)'
                                    : 'var(--danger)',
                            }}
                          >
                            {pt.pointNumber}
                          </div>
                          <div className="plan-points-list__content">
                            <div className="plan-points-list__title">{pt.title}</div>
                            <div className="plan-points-list__badges">
                              <span className="badge badge--info" style={{ fontSize: '0.7rem' }}>
                                {categoryLabels[pt.category] || pt.category}
                              </span>
                              <span className={`badge ${statusBadge[pt.status]}`} style={{ fontSize: '0.7rem' }}>
                                {statusLabels[pt.status]}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="plan-points-list__chevron" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Side panel */}
          <PlanPointPanel
            isOpen={isPanelOpen}
            mode={panelMode === 'closed' ? 'detail' : panelMode}
            point={panelMode === 'edit' ? editingPoint || undefined : selectedPoint || undefined}
            points={currentPlan.points}
            onClose={handlePanelClose}
            onSave={handleSavePoint}
            onDelete={handleDeletePoint}
            onEdit={handleEditFromDetail}
            onNavigate={handleNavigatePoint}
          />
        </div>
      </div>
    );
  }

  return null;
};
