import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Map, Trash2, ZoomIn, ZoomOut, FileText, Loader2, Upload, Camera, ChevronRight, ClipboardList, Search, Play, CheckCircle2 } from 'lucide-react';
import { plansApi, ApiPlan, ApiPlanPoint, ApiPlanListItem } from '../services/api';
import { PlanPointFormData } from './PlanPointForm';
import { PlanPointPanel } from './PlanPointPanel';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from './ui/ConfirmModal';

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


const PinMarker: React.FC<{
  point: ApiPlanPoint;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ point, isSelected, onClick }) => {
  const isProblem = point.status === 'a_faire' || point.category === 'defaut';
  const color = isProblem ? '#ef4444' : point.status === 'termine' ? '#22c55e' : '#f59e0b';

  return (
    <div
      className={`pin-marker ${isSelected ? 'pin-marker--active' : ''} ${isProblem ? 'pin-marker--problem' : ''}`}
      data-point-id={point.id}
      style={{
        left: `${point.positionX}%`,
        top: `${point.positionY}%`,
        animation: 'pin-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        animationDelay: `${Math.random() * 0.2}s` // Random delay for natural feel
      }}
      onClick={onClick}
      title={`#${point.pointNumber} ${point.title}`}
    >
      <div className="pin-svg-wrapper" style={{ transform: 'translate(-50%, -100%)' }}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pin-svg"
        >
          <path
            d="M20 0C11.1634 0 4 7.16344 4 16C4 26.5 20 40 20 40C20 40 36 26.5 36 16C36 7.16344 28.8366 0 20 0Z"
            fill={color}
          />
          <circle cx="20" cy="16" r="6" fill="#0f172a" fillOpacity="0.3" />
          <circle cx="20" cy="16" r="3" fill="white" />
          {isProblem && (
            <path
              d="M20 8V18"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ opacity: 0.8 }}
            />
          )}
        </svg>
        {/* Number Badge */}
        <div
          style={{
            position: 'absolute',
            top: '5px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}
        >
          {point.pointNumber}
        </div>
      </div>
    </div>
  );
};

export const PlanView: React.FC<PlanViewProps> = ({ onBack }) => {
  const { toast } = useToast();

  // Sub-views
  const [subView, setSubView] = useState<SubView>('LIST');

  // Confirm dialog (centralized: avoid native confirm() which breaks the premium feel)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

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
  type ViewerTab = 'PLAN' | 'ACTION';
  const [viewerTab, setViewerTab] = useState<ViewerTab>('PLAN');

  // Action plan filters
  const [actionQuery, setActionQuery] = useState('');
  const [actionCategory, setActionCategory] = useState<'all' | string>('all');

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
      setViewerTab('PLAN');
      setActionQuery('');
      setActionCategory('all');
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      setClickPosition(null);
    } catch (err) {
      console.error('Error loading plan:', err);
      toast.error('Erreur lors du chargement du plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      title: 'Supprimer ce plan ?',
      message: 'Supprimer ce plan et tous ses points. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await plansApi.deletePlan(planId);
          setPlans((prev) => prev.filter((p) => p.id !== planId));
          toast.success('Plan supprimé.');
        } catch (err) {
          console.error('Error deleting plan:', err);
          toast.error('Erreur lors de la suppression du plan.');
        }
      },
    });
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
      setViewerTab('PLAN');
      setActionQuery('');
      setActionCategory('all');
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      setClickPosition(null);
      // Reset upload form
      setUploadSiteName('');
      setUploadAddress('');
      setUploadImageDataUrl('');
      toast.success('Plan créé.');
    } catch (err) {
      console.error('Error creating plan:', err);
      toast.error('Erreur lors de la création du plan.');
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
        toast.success('Point mis à jour.');
      } catch (err) {
        console.error('Error updating point:', err);
        toast.error('Erreur lors de la mise à jour du point.');
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
        toast.success('Point ajouté.');
      } catch (err) {
        console.error('Error creating point:', err);
        toast.error('Erreur lors de la création du point.');
      }
    }
  };

  const performDeletePoint = async (pointId: string) => {
    if (!currentPlan) return;
    try {
      await plansApi.deletePoint(currentPlan.id, pointId);
      setCurrentPlan((prev) =>
        prev ? { ...prev, points: prev.points.filter((p) => p.id !== pointId) } : null
      );
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      toast.success('Point supprimé.');
    } catch (err) {
      console.error('Error deleting point:', err);
      toast.error('Erreur lors de la suppression du point.');
    }
  };

  const handleDeletePoint = (pointId: string) => {
    if (!currentPlan) return;
    const point = currentPlan.points.find((p) => p.id === pointId);
    setConfirmState({
      title: point ? `Supprimer le point #${point.pointNumber} ?` : 'Supprimer ce point ?',
      message: point
        ? `Supprimer le point "${point.title}". Cette action est irréversible.`
        : 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      isDestructive: true,
      onConfirm: async () => performDeletePoint(pointId),
    });
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

  const handleFocusPoint = (point: ApiPlanPoint) => {
    // Switch to plan view to make the "subpage to the right" feel connected to the marker.
    setViewerTab('PLAN');
    window.setTimeout(() => {
      const el = document.querySelector(`[data-point-id="${point.id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 60);
  };

  const handleUpdatePointStatus = async (pointId: string, status: ApiPlanPoint['status']) => {
    if (!currentPlan) return;
    try {
      const updated = await plansApi.updatePoint(currentPlan.id, pointId, { status });
      setCurrentPlan((prev) =>
        prev ? { ...prev, points: prev.points.map((p) => (p.id === updated.id ? updated : p)) } : null
      );
      setSelectedPoint(updated);
      setEditingPoint(null);
      setPanelMode('detail');
      toast.success('Statut mis à jour.');
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  };

  const handleDownloadPointPdf = async (point: ApiPlanPoint) => {
    if (!currentPlan) return;
    try {
      const { generatePointPDF } = await import('../services/point-pdf');
      const { blob, filename } = await generatePointPDF(currentPlan, point);
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
      toast.success('PDF généré.');
    } catch (err) {
      console.error('Error generating point PDF:', err);
      toast.error('Erreur lors de la génération du PDF du point.');
    }
  };

  // Auto-focus the marker when navigating points in PLAN tab.
  useEffect(() => {
    if (subView !== 'VIEWER') return;
    if (!selectedPoint) return;
    if (panelMode === 'closed') return;
    if (viewerTab !== 'PLAN') return;
    const id = selectedPoint.id;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-point-id="${id}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 30);
    return () => window.clearTimeout(t);
  }, [selectedPoint, panelMode, viewerTab, subView]);

  // PDF
  const handleGeneratePdf = async () => {
    if (!currentPlan) return;
    setGeneratingPdf(true);
    try {
      const { generatePlanPDFPremium } = await import('../services/plan-pdf-premium');
      const { blob, filename } = await generatePlanPDFPremium(currentPlan);
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
      toast.success('PDF généré.');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Erreur lors de la génération du PDF.');
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
      <>
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

        <ConfirmModal
          isOpen={!!confirmState}
          onClose={() => setConfirmState(null)}
          onConfirm={async () => confirmState?.onConfirm()}
          title={confirmState?.title ?? ''}
          message={confirmState?.message ?? ''}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel={confirmState?.cancelLabel}
          isDestructive={confirmState?.isDestructive}
        />
      </>
    );
  }

  // UPLOAD view
  if (subView === 'UPLOAD') {
    return (
      <>
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

        <ConfirmModal
          isOpen={!!confirmState}
          onClose={() => setConfirmState(null)}
          onConfirm={async () => confirmState?.onConfirm()}
          title={confirmState?.title ?? ''}
          message={confirmState?.message ?? ''}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel={confirmState?.cancelLabel}
          isDestructive={confirmState?.isDestructive}
        />
      </>
    );
  }

  // VIEWER view
  if (subView === 'VIEWER' && currentPlan) {
    const isPanelOpen = panelMode !== 'closed';
    const allPointsSorted = [...currentPlan.points].sort((a, b) => a.pointNumber - b.pointNumber);

    const filteredForAction = allPointsSorted.filter((p) => {
      const q = actionQuery.trim().toLowerCase();
      if (q) {
        const hay = `${p.pointNumber} ${p.title} ${p.description || ''} ${p.room || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (actionCategory !== 'all' && p.category !== actionCategory) return false;
      return true;
    });

    const byStatus = {
      a_faire: filteredForAction.filter((p) => p.status === 'a_faire'),
      en_cours: filteredForAction.filter((p) => p.status === 'en_cours'),
      termine: filteredForAction.filter((p) => p.status === 'termine'),
    };

    const totalPoints = currentPlan.points.length;
    const donePoints = currentPlan.points.filter((p) => p.status === 'termine').length;
    const completionRate = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

    return (
      <>
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

              {/* Tabs */}
              <div className="plan-tabs">
                <button
                  className={`plan-tab${viewerTab === 'PLAN' ? ' plan-tab--active' : ''}`}
                  onClick={() => setViewerTab('PLAN')}
                  type="button"
                >
                  <Map size={16} /> Plan
                </button>
                <button
                  className={`plan-tab${viewerTab === 'ACTION' ? ' plan-tab--active' : ''}`}
                  onClick={() => setViewerTab('ACTION')}
                  type="button"
                >
                  <ClipboardList size={16} /> Plan d'action
                </button>
                <div className="plan-tabs__spacer" />
                <div className="plan-tabs__stats">
                  <span className="badge badge--info">{completionRate}% terminé</span>
                  <span className="badge badge--danger">{currentPlan.points.filter((p) => p.status === 'a_faire').length} à faire</span>
                  <span className="badge badge--warning">{currentPlan.points.filter((p) => p.status === 'en_cours').length} en cours</span>
                </div>
              </div>

              {viewerTab === 'PLAN' && (
                <>
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
                        <PinMarker
                          key={pt.id}
                          point={pt}
                          isSelected={!!(selectedPoint?.id === pt.id && isPanelOpen)}
                          onClick={(e) => handleMarkerClick(pt, e)}
                        />
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
                        {allPointsSorted.map((pt) => (
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
                </>
              )}

              {viewerTab === 'ACTION' && (
                <div className="plan-action">
                  <div className="plan-action__filters">
                    <div className="plan-action__search">
                      <Search size={16} />
                      <input
                        className="input plan-action__search-input"
                        value={actionQuery}
                        onChange={(e) => setActionQuery(e.target.value)}
                        placeholder="Rechercher un point (#, titre, lieu...)"
                      />
                    </div>
                    <select
                      className="input select plan-action__select"
                      value={actionCategory}
                      onChange={(e) => setActionCategory(e.target.value || 'all')}
                      aria-label="Filtrer par catégorie"
                    >
                      <option value="all">Toutes catégories</option>
                      {Object.keys(categoryLabels).map((cat) => (
                        <option key={cat} value={cat}>
                          {categoryLabels[cat]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn--ghost plan-action__add"
                      onClick={() => setViewerTab('PLAN')}
                      type="button"
                      title="Ajouter un point en cliquant sur le plan"
                    >
                      <Plus size={16} /> Ajouter sur le plan
                    </button>
                  </div>

                  <div className="plan-action__hint">
                    Affichage: <strong>{filteredForAction.length}</strong> / {currentPlan.points.length} point(s)
                  </div>

                  <div className="plan-action-board">
                    {(
                      [
                        { key: 'a_faire', title: 'À faire', badge: 'badge--danger' },
                        { key: 'en_cours', title: 'En cours', badge: 'badge--warning' },
                        { key: 'termine', title: 'Terminé', badge: 'badge--success' },
                      ] as const
                    ).map((col) => {
                      const items = byStatus[col.key];
                      return (
                        <section key={col.key} className="plan-action-col">
                          <header className="plan-action-col__header">
                            <div className="plan-action-col__title">{col.title}</div>
                            <span className={`badge ${col.badge}`}>{items.length}</span>
                          </header>
                          <div className="plan-action-col__list">
                            {items.length === 0 ? (
                              <div className="plan-action-col__empty">Aucun point</div>
                            ) : (
                              items.map((pt) => {
                                const next =
                                  pt.status === 'a_faire'
                                    ? { to: 'en_cours' as const, label: 'Démarrer', Icon: Play }
                                    : pt.status === 'en_cours'
                                      ? { to: 'termine' as const, label: 'Terminer', Icon: CheckCircle2 }
                                      : null;

                                return (
                                  <article
                                    key={pt.id}
                                    className={`plan-action-card${selectedPoint?.id === pt.id && isPanelOpen ? ' plan-action-card--active' : ''}`}
                                    onClick={() => {
                                      setSelectedPoint(pt);
                                      setEditingPoint(null);
                                      setPanelMode('detail');
                                    }}
                                  >
                                    <div
                                      className="plan-action-card__num"
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
                                    <div className="plan-action-card__body">
                                      <div className="plan-action-card__title">{pt.title}</div>
                                      <div className="plan-action-card__meta">
                                        {categoryLabels[pt.category] || pt.category}
                                        {pt.room ? ` • ${pt.room}` : ''}
                                      </div>
                                    </div>
                                    {next && (
                                      <button
                                        type="button"
                                        className="btn btn--ghost plan-action-card__next"
                                        title={next.label}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdatePointStatus(pt.id, next.to);
                                        }}
                                      >
                                        <next.Icon size={16} />
                                      </button>
                                    )}
                                    <ChevronRight size={16} className="plan-action-card__chevron" />
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </section>
                      );
                    })}
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
            onFocusPoint={handleFocusPoint}
            onDownloadPointPdf={handleDownloadPointPdf}
            onUpdateStatus={handleUpdatePointStatus}
          />
        </div>
        </div>

        <ConfirmModal
          isOpen={!!confirmState}
          onClose={() => setConfirmState(null)}
          onConfirm={async () => confirmState?.onConfirm()}
          title={confirmState?.title ?? ''}
          message={confirmState?.message ?? ''}
          confirmLabel={confirmState?.confirmLabel}
          cancelLabel={confirmState?.cancelLabel}
          isDestructive={confirmState?.isDestructive}
        />
      </>
    );
  }

  return null;
};
