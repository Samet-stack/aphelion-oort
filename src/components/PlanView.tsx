import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Map, Trash2, FileText, Loader2, Camera, ChevronRight, ClipboardList, Building2, Layers, FilePlus, Upload } from 'lucide-react';
import { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { plansApi, sitesApi, ApiPlan, ApiPlanPoint, ApiPlanListItem, ApiSite, ApiSiteListItem } from '../services/api';
import { PlanPointFormData } from './PlanPointForm';
import { PlanPointPanel } from './PlanPointPanel';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal, PageHeader, EmptyState, LoadingState } from './ui';
import { closePendingPdfTab, openPendingPdfTab, presentPdfBlob } from '../services/pdf-open';

// Import new sub-components
import { PlanHeader } from './plan/PlanHeader';
import { PlanCanvas } from './plan/PlanCanvas';
import { PlanActionBoard } from './plan/PlanActionBoard';
// import { PlanSiteList } from './plan/PlanSiteList'; // Note: PlanSiteList was created but we need to adjust types/props slightly to match exactly or just keep it minimal.
// Let's implement PlanSiteList usage inline or import it if compatible. 
// For now, I'll keep the Site List view here as it's separate from the "Plan View" logic mostly, 
// OR I'll use it if I'm confident. Let's use it to clean up.
// import { PlanSiteList } from './plan/PlanSiteList'; 
// Actually, I'll keep it inline to avoid prop drilling complexity for now on delete handlers etc, 
// or I can do a quick inline refactor if it's easy.
// Let's use the new components first for the MAIN complexity which is the VIEWER.

interface PlanViewProps {
  onBack: () => void;
  onCreateReportFromPoint?: (plan: ApiPlan, point: ApiPlanPoint) => void;
  onStartReportFromPlan?: (plan: ApiPlan) => void;
  initialPlanId?: string | null;
  initialPointId?: string | null;
}

type SubView = 'SITES' | 'CREATE_SITE' | 'SITE' | 'UPLOAD_PLAN' | 'VIEWER';

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

export const PlanView: React.FC<PlanViewProps> = ({
  onBack,
  onCreateReportFromPoint,
  onStartReportFromPlan,
  initialPlanId,
  initialPointId,
}) => {
  const { toast } = useToast();

  // Sub-views
  const [subView, setSubView] = useState<SubView>('SITES');

  // Confirm dialog (centralized)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Sites list
  const [sites, setSites] = useState<ApiSiteListItem[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  // Current site + its plans
  const [currentSite, setCurrentSite] = useState<ApiSite | null>(null);
  const [sitePlans, setSitePlans] = useState<ApiPlanListItem[]>([]);
  const [loadingSite, setLoadingSite] = useState(false);

  // Current plan
  const [currentPlan, setCurrentPlan] = useState<ApiPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Create site
  const [siteNameInput, setSiteNameInput] = useState('');
  const [siteAddressInput, setSiteAddressInput] = useState('');

  // Upload plan
  const [planNameInput, setPlanNameInput] = useState('Plan principal');
  const [planImageDataUrl, setPlanImageDataUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Viewer
  const [zoomPercent, setZoomPercent] = useState(100);
  const [viewerTransformKey, setViewerTransformKey] = useState(0);
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const gestureInProgressRef = useRef(false);
  const lastGestureEndAtRef = useRef(0);
  type ViewerTab = 'PLAN' | 'ACTION';
  const [viewerTab, setViewerTab] = useState<ViewerTab>('PLAN');

  // Pointer tracking
  const pointerDownPos = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // Side panel
  type PanelMode = 'closed' | 'detail' | 'edit' | 'create';
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ApiPlanPoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<ApiPlanPoint | null>(null);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const data = await sitesApi.getAll();
      setSites(data);
    } catch (err) {
      console.error('Error loading sites:', err);
      toast.error('Erreur lors du chargement des chantiers.');
    } finally {
      setLoadingSites(false);
    }
  }, [toast]);

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const openSite = async (siteId: string) => {
    setLoadingSite(true);
    try {
      const site = await sitesApi.getById(siteId);
      setCurrentSite(site);
      setSitePlans(site.plans || []);
      setCurrentPlan(null);
      setSubView('SITE');
    } catch (err) {
      console.error('Error loading site:', err);
      toast.error('Erreur lors du chargement du chantier.');
    } finally {
      setLoadingSite(false);
    }
  };

  const refreshCurrentSitePlans = useCallback(
    async (siteId?: string) => {
      const id = siteId || currentSite?.id;
      if (!id) return;
      try {
        const plans = await plansApi.getAll({ siteId: id });
        setSitePlans(plans);
      } catch (err) {
        console.error('Error loading site plans:', err);
      }
    },
    [currentSite?.id]
  );

  const focusPointAfterOpenRef = useRef<string | null>(null);
  const appliedInitialRef = useRef(false);

  const openPlan = useCallback(
    async (planId: string, opts?: { focusPointId?: string | null; fromResume?: boolean }) => {
      focusPointAfterOpenRef.current = opts?.focusPointId || null;
      setLoadingPlan(true);
      try {
        const plan = await plansApi.getById(planId);
        setCurrentPlan(plan);
        // Ensure we have the site context
        if (!currentSite || currentSite.id !== plan.siteId) {
          try {
            const site = await sitesApi.getById(plan.siteId);
            setCurrentSite(site);
            setSitePlans(site.plans || []);
          } catch {
            setCurrentSite({
              id: plan.siteId,
              siteName: plan.siteName,
              address: plan.address,
              createdAt: plan.createdAt,
              updatedAt: plan.updatedAt,
            });
            if (!opts?.fromResume) {
              await refreshCurrentSitePlans(plan.siteId);
            }
          }
        }

        setSubView('VIEWER');
        setZoomPercent(100);
        setViewerTransformKey((prev) => prev + 1);
        setViewerTab('PLAN');
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
    },
    [currentSite, refreshCurrentSitePlans, toast]
  );

  // Resume mechanics ...
  useEffect(() => {
    if (appliedInitialRef.current) return;
    if (!initialPlanId) return;
    appliedInitialRef.current = true;
    openPlan(initialPlanId, { focusPointId: initialPointId || null, fromResume: true });
  }, [initialPlanId, initialPointId, openPlan]);

  useEffect(() => {
    if (subView !== 'VIEWER') return;
    if (!currentPlan) return;
    const focusId = focusPointAfterOpenRef.current;
    if (!focusId) return;

    const pt = currentPlan.points.find((p) => p.id === focusId);
    if (pt) {
      setSelectedPoint(pt);
      setEditingPoint(null);
      setPanelMode('detail');
      setViewerTab('PLAN');
    }
    focusPointAfterOpenRef.current = null;
  }, [currentPlan, subView]);

  const handleDeleteSite = async (siteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      title: 'Supprimer ce chantier ?',
      message: 'Supprimer ce chantier, tous ses plans et tous ses points. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await sitesApi.deleteSite(siteId);
          setSites((prev) => prev.filter((s) => s.id !== siteId));
          if (currentSite?.id === siteId) {
            setCurrentSite(null);
            setSitePlans([]);
            setCurrentPlan(null);
            setSubView('SITES');
          }
          toast.success('Chantier supprimé.');
        } catch (err) {
          console.error('Error deleting site:', err);
          toast.error('Erreur lors de la suppression du chantier.');
        }
      },
    });
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
          setSitePlans((prev) => prev.filter((p) => p.id !== planId));
          if (currentPlan?.id === planId) {
            setCurrentPlan(null);
            setSubView('SITE');
          }
          await loadSites();
          toast.success('Plan supprimé.');
        } catch (err) {
          console.error('Error deleting plan:', err);
          toast.error('Erreur lors de la suppression du plan.');
        }
      },
    });
  };

  // Upload handlers ...
  const handleUploadFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setPlanImageDataUrl(dataUrl);
  };

  const handleCreateSiteSubmit = async () => {
    if (!siteNameInput.trim()) return;
    setUploading(true);
    try {
      const site = await sitesApi.create({
        siteName: siteNameInput.trim(),
        address: siteAddressInput.trim() || undefined,
      });
      setCurrentSite(site);
      setSitePlans([]);
      setCurrentPlan(null);
      setSubView('SITE');
      setSiteNameInput('');
      setSiteAddressInput('');
      await loadSites();
      toast.success('Chantier créé.');
    } catch (err) {
      console.error('Error creating site:', err);
      toast.error('Erreur lors de la création du chantier.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPlanSubmit = async () => {
    if (!currentSite) return;
    if (!planNameInput.trim() || !planImageDataUrl) return;
    setUploading(true);
    try {
      const plan = await plansApi.create({
        siteId: currentSite.id,
        planName: planNameInput.trim(),
        imageDataUrl: planImageDataUrl,
      });
      setCurrentPlan(plan);
      setSubView('VIEWER');
      setZoomPercent(100);
      setViewerTransformKey((prev) => prev + 1);
      setViewerTab('PLAN');
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      setClickPosition(null);
      setPlanNameInput('Plan principal');
      setPlanImageDataUrl('');
      await refreshCurrentSitePlans(currentSite.id);
      await loadSites();
      toast.success('Plan créé.');
    } catch (err) {
      console.error('Error creating plan:', err);
      toast.error('Erreur lors de la création du plan.');
    } finally {
      setUploading(false);
    }
  };

  // Canvas interactions
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch' && !e.isPrimary) {
      pointerDownPos.current = null;
      lastGestureEndAtRef.current = performance.now();
      return;
    }
    pointerDownPos.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  }, []);

  const handleCanvasPointerCancel = useCallback(() => {
    pointerDownPos.current = null;
  }, []);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const down = pointerDownPos.current;
    pointerDownPos.current = null;
    if (!down || down.pointerId !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-point-id]')) return;
    if (gestureInProgressRef.current) return;
    if (performance.now() - lastGestureEndAtRef.current < 160) return;

    const dx = Math.abs(e.clientX - down.x);
    const dy = Math.abs(e.clientY - down.y);
    if (dx > 8 || dy > 8) return;

    // We can't access imageRef directly easily if it's inside PlanCanvas -> TransformComponent.
    // However, PlanCanvas uses forwardRef for the TransformWrapper, but we need the image element dims.
    // A better approach for the refactor: Calculate position based on the event target which IS the image or canvas?
    // Actually, e.target in PlanCanvas will be the image or the wrapper.
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Check if we clicked on the image
    if (!target.classList.contains('plan-viewer__image')) return;

    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;

    if (posX < 0 || posX > 100 || posY < 0 || posY > 100) return;

    setClickPosition({ x: posX, y: posY });
    setEditingPoint(null);
    setSelectedPoint(null);
    setPanelMode('create');
  }, []);

  const handleMarkerClick = (point: ApiPlanPoint, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelectedPoint(point);
    setEditingPoint(null);
    setPanelMode('detail');
  };

  // Point CRUD handlers ...
  const handleSavePoint = async (data: PlanPointFormData) => {
    if (!currentPlan) return;

    if (editingPoint) {
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

  const handleDeletePoint = (pointId: string) => {
    if (!currentPlan) return;
    const point = currentPlan.points.find((p) => p.id === pointId);
    setConfirmState({
      title: point ? `Supprimer le point #${point.pointNumber} ?` : 'Supprimer ce point ?',
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      isDestructive: true,
      onConfirm: async () => {
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
      },
    });
  };

  const handleUpdatePointStatus = async (pointId: string, status: ApiPlanPoint['status']) => {
    if (!currentPlan) return;
    try {
      const updated = await plansApi.updatePoint(currentPlan.id, pointId, { status });
      setCurrentPlan((prev) =>
        prev ? { ...prev, points: prev.points.map((p) => (p.id === updated.id ? updated : p)) } : null
      );
      if (selectedPoint?.id === pointId) {
        setSelectedPoint(updated);
      }
      toast.success('Statut mis à jour.');
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  };

  // ... other methods (PDF, Focus etc)
  const centerPointInViewer = useCallback((pointId: string) => {
    // We use a query selector to find the marker DOM element. 
    // This works because the markers are rendered in the DOM with data-point-id
    const marker = document.querySelector(`[data-point-id="${pointId}"]`) as HTMLElement | null;
    if (!marker || !transformRef.current) return;
    const currentScale = transformRef.current.instance.transformState.scale;
    transformRef.current.zoomToElement(marker, currentScale, 240, 'easeOut');
  }, []);

  const handleFocusPoint = (point: ApiPlanPoint) => {
    setViewerTab('PLAN');
    window.setTimeout(() => {
      centerPointInViewer(point.id);
    }, 60);
  };

  const handleDownloadPointPdf = async (point: ApiPlanPoint) => {
    if (!currentPlan) return;
    const pendingTab = openPendingPdfTab();
    try {
      const { generatePointPDF } = await import('../services/point-pdf');
      const { blob, filename } = await generatePointPDF(currentPlan, point);
      presentPdfBlob({ blob, filename, pendingTab });
      toast.success('PDF généré.');
    } catch (err) {
      closePendingPdfTab(pendingTab);
      console.error('Error generating point PDF:', err);
      toast.error('Erreur lors de la génération du PDF du point.');
    }
  };

  const handleGeneratePdf = async () => {
    if (!currentPlan) return;
    setGeneratingPdf(true);
    const pendingTab = openPendingPdfTab();
    try {
      const { generatePlanPDFPremium } = await import('../services/plan-pdf-premium');
      const { blob, filename } = await generatePlanPDFPremium(currentPlan);
      presentPdfBlob({ blob, filename, pendingTab });
      toast.success('PDF généré.');
    } catch (err) {
      closePendingPdfTab(pendingTab);
      console.error('Error generating PDF:', err);
      toast.error('Erreur lors de la génération du PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Zoom handlers
  const syncZoomPercent = useCallback((ref: ReactZoomPanPinchContentRef) => {
    // ReactZoomPanPinchContentRef uses 'instance.transformState' not 'state' directly usually?
    // Actually the type definition for ContentRef usually exposes `instance`.
    // Let's use `ref.instance.transformState.scale` if available or casting.
    // Based on library docs: ref.instance.transformState.scale
    if (ref.instance && ref.instance.transformState) {
      setZoomPercent(Math.round(ref.instance.transformState.scale * 100));
    } else {
      // Fallback or explicit any if type definitions are tricky
      setZoomPercent(Math.round((ref as any).state?.scale * 100) || 100);
    }
  }, []);

  const beginGesture = useCallback(() => {
    gestureInProgressRef.current = true;
  }, []);

  const endGesture = useCallback((ref: ReactZoomPanPinchContentRef) => {
    gestureInProgressRef.current = false;
    lastGestureEndAtRef.current = performance.now();
    syncZoomPercent(ref);
  }, [syncZoomPercent]);

  // Derived state
  const isPanelOpen = panelMode !== 'closed';
  const completionRate = useMemo(() => {
    if (!currentPlan) return 0;
    const totalPoints = currentPlan.points.length;
    if (totalPoints === 0) return 0;
    const donePoints = currentPlan.points.filter((p) => p.status === 'termine').length;
    return Math.round((donePoints / totalPoints) * 100);
  }, [currentPlan]);

  const allPointsSorted = useMemo(() => {
    if (!currentPlan) return [];
    return [...currentPlan.points].sort((a, b) => a.pointNumber - b.pointNumber);
  }, [currentPlan]);


  const handleBackToSite = useCallback(() => {
    setCurrentPlan(null);
    setPanelMode('closed');
    setSubView('SITE');
    refreshCurrentSitePlans();
    loadSites();
  }, [refreshCurrentSitePlans, loadSites]);

  // === RENDER ===

  if (subView === 'SITES') {
    return (
      <>
        <div className="view">
          <div className="view__top">
            <button type="button" onClick={onBack} className="link-btn">
              <ArrowLeft size={16} /> Accueil
            </button>
          </div>
          <div className="card">
            <PageHeader
              title="Chantiers"
              icon={Building2}
              subtitle="Organisez vos plans et vos points par chantier."
            >
              <button type="button" className="btn btn--primary" onClick={() => {
                setSiteNameInput('');
                setSiteAddressInput('');
                setSubView('CREATE_SITE');
              }}>
                <Plus size={16} /> Choisir un chantier
              </button>
            </PageHeader>
            {loadingSites ? (
              <LoadingState text="Chargement..." />
            ) : sites.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Aucun chantier pour le moment."
                hint='Cliquez sur "Nouveau chantier" pour commencer.'
              />
            ) : (
              <div className="plan-list">
                {sites.map((site) => (
                  <div key={site.id} className="plan-card" onClick={() => openSite(site.id)}>
                    <div className="plan-card__info">
                      <span className="plan-card__name">{site.siteName}</span>
                      <span className="plan-card__meta">
                        {site.address ? `${site.address} · ` : ''}
                        {site.plansCount} plan(s) · {site.pointsCount} point(s)
                      </span>
                    </div>
                    <div className="plan-card__badge">
                      <span className="badge badge--info">{site.plansCount} plan(s)</span>
                      <span className="badge badge--info">{site.pointsCount} point(s)</span>
                      <button className="btn btn--ghost btn-danger-ghost" onClick={(e) => handleDeleteSite(site.id, e)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {loadingSite && (
            <div className="modal-overlay">
              <div className="modal-loading">
                <Loader2 size={32} className="spin" />
                <p className="modal-loading__text">Chargement du chantier...</p>
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

  if (subView === 'CREATE_SITE') {
    // ... logic remains same, just rendering
    return (
      <>
        <div className="view">
          <div className="view__top">
            <button type="button" onClick={() => setSubView('SITES')} className="link-btn">
              <ArrowLeft size={16} /> Chantiers
            </button>
          </div>
          <div className="card">
            <PageHeader title="Nouveau chantier" icon={Plus} compact />
            <div className="plan-upload">
              <div className="form-field">
                <label>Nom du chantier *</label>
                <input type="text" className="input" value={siteNameInput} onChange={(e) => setSiteNameInput(e.target.value)} placeholder="Ex: Residence Les Cerisiers" />
              </div>
              <div className="form-field">
                <label>Adresse</label>
                <input type="text" className="input" value={siteAddressInput} onChange={(e) => setSiteAddressInput(e.target.value)} placeholder="Ex: 12 rue des Lilas, 75001 Paris" />
              </div>
              <button className="btn btn--primary form-actions--full" onClick={handleCreateSiteSubmit} disabled={!siteNameInput.trim() || uploading}>
                {uploading ? <><Loader2 size={16} className="spin" /> Creation...</> : 'Creer le chantier'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (subView === 'SITE' && currentSite) {
    return (
      <>
        <div className="view">
          <div className="view__top">
            <button type="button" onClick={() => {
              setCurrentPlan(null);
              setCurrentSite(null);
              setSitePlans([]);
              setSubView('SITES');
              loadSites();
            }} className="link-btn">
              <ArrowLeft size={16} /> Chantiers
            </button>
          </div>
          <div className="card">
            <PageHeader title={currentSite.siteName} icon={Building2} subtitle={currentSite.address || 'Adresse non renseignée'} compact>
              <div className="card-actions">
                <button className="btn btn--ghost btn-danger-ghost" onClick={(e) => handleDeleteSite(currentSite.id, e)} title="Supprimer">
                  <Trash2 size={16} />
                </button>
                <button type="button" className="btn btn--primary" onClick={() => {
                  setPlanNameInput('Plan principal');
                  setPlanImageDataUrl('');
                  setSubView('UPLOAD_PLAN');
                }}>
                  <Plus size={16} /> Ajouter un plan
                </button>
              </div>
            </PageHeader>
            {loadingSite ? <LoadingState text="Chargement..." /> : sitePlans.length === 0 ? (
              <EmptyState icon={Layers} title="Aucun plan." hint='Cliquez sur "Ajouter un plan".' />
            ) : (
              <div className="plan-list">
                {sitePlans.map((plan) => (
                  <div key={plan.id} className="plan-card" onClick={() => openPlan(plan.id)}>
                    <div className="plan-card__info">
                      <span className="plan-card__name">{plan.planName}</span>
                      <span className="plan-card__meta">{plan.pointsCount} point(s) · {new Date(plan.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="plan-card__badge">
                      <span className="badge badge--info">{plan.pointsCount} point(s)</span>
                      <button className="btn btn--ghost btn-danger-ghost" onClick={(e) => handleDeletePlan(plan.id, e)}>
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
              <div className="modal-loading"><Loader2 size={32} className="spin" /><p className="modal-loading__text">Chargement du plan...</p></div>
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

  if (subView === 'UPLOAD_PLAN' && currentSite) {
    // ... render logic same as before, abbreviated for simplicity since we focus on refactor
    return (
      <div className="view">
        <div className="view__top">
          <button onClick={() => setSubView('SITE')} className="link-btn"><ArrowLeft size={16} /> Retour chantier</button>
        </div>
        <div className="card">
          <PageHeader title="Ajouter un plan" icon={FilePlus} compact />
          <div className="plan-upload">
            <div className="form-field"><label>Nom du plan *</label><input className="input" value={planNameInput} onChange={e => setPlanNameInput(e.target.value)} /></div>
            <div className="form-field">
              <label>Image *</label>
              <input
                type="file"
                accept="image/*"
                ref={uploadInputRef}
                className="hidden"
                onChange={e => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
              />
              {planImageDataUrl ? (
                <div>
                  <div className="plan-upload__preview">
                    <img src={planImageDataUrl} alt="Preview" />
                  </div>
                  <button
                    className="btn btn--ghost upload-preview-actions"
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <Camera size={16} /> Changer l'image
                  </button>
                </div>
              ) : (
                <div
                  className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleUploadFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <div className="dropzone__icon"><Upload size={28} /></div>
                  <p className="dropzone__title">Deposez le plan ou cliquez pour importer</p>
                  <p className="dropzone__hint">Formats JPG, PNG</p>
                </div>
              )}
            </div>
            <button className="btn btn--primary form-actions--full" onClick={handleUploadPlanSubmit} disabled={!planNameInput || !planImageDataUrl || uploading}>{uploading ? 'Creation...' : 'Creer'}</button>
          </div>
        </div>
      </div>
    );
  }

  // VIEWER
  if (subView === 'VIEWER' && currentPlan) {
    return (
      <>
        <div className="view">
          {/* Header with actions */}
          <div className="view__top">
            <button type="button" onClick={handleBackToSite} className="link-btn">
              <ArrowLeft size={16} /> Retour chantier
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {onStartReportFromPlan && (
                <button className="btn btn--ghost" onClick={() => onStartReportFromPlan(currentPlan)} type="button">
                  <Camera size={16} /> Nouveau rapport
                </button>
              )}
              <button className="btn btn--primary" onClick={handleGeneratePdf} disabled={generatingPdf}>
                {generatingPdf ? <><Loader2 size={16} className="spin" /> Generation...</> : <><FileText size={16} /> Generer Rapport PDF</>}
              </button>
            </div>
          </div>

          {/* Layout */}
          <div className={`plan-viewer-layout ${isPanelOpen ? 'plan-viewer-layout--open' : ''}`}>
            <div className="plan-viewer-layout__main">
              <div className="card">
                {/* Plan Header */}
                <div style={{ marginBottom: '1rem' }}>
                  <PlanHeader
                    planName={currentPlan.planName}
                    siteName={currentPlan.siteName}
                    onBack={handleBackToSite}
                    zoomPercent={zoomPercent}
                    zoomIn={() => transformRef.current?.zoomIn(0.25)}
                    zoomOut={() => transformRef.current?.zoomOut(0.25)}
                    resetTransform={() => transformRef.current?.resetTransform()}
                  />
                </div>

                {/* Tabs */}
                <div className="plan-tabs">
                  <button className={`plan-tab${viewerTab === 'PLAN' ? ' plan-tab--active' : ''}`} onClick={() => setViewerTab('PLAN')} type="button">
                    <Map size={16} /> Plan
                  </button>
                  <button className={`plan-tab${viewerTab === 'ACTION' ? ' plan-tab--active' : ''}`} onClick={() => setViewerTab('ACTION')} type="button">
                    <ClipboardList size={16} /> Plan d'action
                  </button>
                  <div className="plan-tabs__spacer" />
                  <div className="plan-tabs__stats">
                    <span className="badge badge--info">{completionRate}% terminé</span>
                    <span className="badge badge--danger">{currentPlan.points.filter((p) => p.status === 'a_faire').length} à faire</span>
                    <span className="badge badge--warning">{currentPlan.points.filter((p) => p.status === 'en_cours').length} en cours</span>
                  </div>
                </div>

                {/* Content */}
                {viewerTab === 'PLAN' && (
                  <>
                    {/* New Sub-Component: PlanCanvas */}
                    <PlanCanvas
                      key={viewerTransformKey}
                      ref={transformRef}
                      imageDataUrl={currentPlan.imageDataUrl}
                      points={currentPlan.points}
                      zoomPercent={zoomPercent}
                      selectedPointId={selectedPoint?.id}
                      isPanelOpen={isPanelOpen}
                      onInit={syncZoomPercent}
                      onZoomChange={syncZoomPercent}
                      onGestureStart={beginGesture}
                      onGestureEnd={endGesture}
                      onCanvasPointerDown={handleCanvasPointerDown}
                      onCanvasPointerUp={handleCanvasPointerUp}
                      onCanvasPointerCancel={handleCanvasPointerCancel}
                      onMarkerClick={handleMarkerClick}
                    />
                    <p className="hint-text">Cliquez sur le plan pour ajouter un point</p>

                    {/* Points List (Bottom of plan) - could be extracted too but keeping simple for now */}
                    {currentPlan.points.length > 0 && (
                      <div className="points-section">
                        <h3 className="points-section__title">Points d'inspection ({currentPlan.points.length})</h3>
                        <div className="plan-points-list">
                          {allPointsSorted.map((pt) => (
                            <div key={pt.id} className={`plan-points-list__item${selectedPoint?.id === pt.id && isPanelOpen ? ' plan-points-list__item--active' : ''}`}
                              onClick={() => { setSelectedPoint(pt); setEditingPoint(null); setPanelMode('detail'); }}
                            >
                              <div className={`plan-points-list__number bg-status-${pt.status}`}>{pt.pointNumber}</div>
                              <div className="plan-points-list__content">
                                <div className="plan-points-list__title">{pt.title}</div>
                                <div className="plan-points-list__badges">
                                  {/* Simple badges */}
                                  <span className={`badge badge--sm badge-${pt.status === 'termine' ? 'success' : pt.status === 'en_cours' ? 'warning' : 'danger'}`}>
                                    {pt.status.replace('_', ' ')}
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
                  <PlanActionBoard
                    currentPlanPoints={currentPlan.points}
                    selectedPointId={selectedPoint?.id || null}
                    isPanelOpen={isPanelOpen}
                    onSelectPoint={(pt) => { setSelectedPoint(pt); setEditingPoint(null); setPanelMode('detail'); }}
                    onAddPointClick={() => setViewerTab('PLAN')}
                    onUpdateStatus={handleUpdatePointStatus}
                  />
                )}
              </div>
            </div>

            {/* Side Panel (Right) */}
            <PlanPointPanel
              isOpen={isPanelOpen}
              mode={panelMode === 'closed' ? 'detail' : panelMode}
              point={panelMode === 'edit' ? editingPoint || undefined : selectedPoint || undefined}
              points={currentPlan.points}
              onClose={() => { setPanelMode('closed'); setSelectedPoint(null); setEditingPoint(null); setClickPosition(null); }}
              onSave={handleSavePoint}
              onDelete={handleDeletePoint}
              onEdit={() => { if (selectedPoint) { setEditingPoint(selectedPoint); setPanelMode('edit'); } }}
              onNavigate={point => { setSelectedPoint(point); setEditingPoint(null); setPanelMode('detail'); }}
              onFocusPoint={handleFocusPoint}
              onDownloadPointPdf={handleDownloadPointPdf}
              onUpdateStatus={handleUpdatePointStatus}
              onCreateReport={onCreateReportFromPoint ? (point) => onCreateReportFromPoint(currentPlan, point) : undefined}
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
