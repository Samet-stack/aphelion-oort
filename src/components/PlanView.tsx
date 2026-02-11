import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Map, Trash2, ZoomIn, ZoomOut, FileText, Loader2, Upload, Camera, ChevronRight, ClipboardList, Search, Play, CheckCircle2, Building2, Layers, FilePlus } from 'lucide-react';
import { plansApi, sitesApi, ApiPlan, ApiPlanPoint, ApiPlanListItem, ApiSite, ApiSiteListItem } from '../services/api';
import { PlanPointFormData } from './PlanPointForm';
import { PlanPointPanel } from './PlanPointPanel';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal, PageHeader, EmptyState, LoadingState } from './ui';
import { PinMarker } from './PinMarker';

interface PlanViewProps {
  onBack: () => void;
  onCreateReportFromPoint?: (plan: ApiPlan, point: ApiPlanPoint) => void;
  onStartReportFromPlan?: (plan: ApiPlan) => void;
  initialPlanId?: string | null;
  initialPointId?: string | null;
}

type SubView = 'SITES' | 'CREATE_SITE' | 'SITE' | 'UPLOAD_PLAN' | 'VIEWER';

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

  // Confirm dialog (centralized: avoid native confirm() which breaks the premium feel)
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

  // Upload plan (inside a site)
  const [planNameInput, setPlanNameInput] = useState('Plan principal');
  const [planImageDataUrl, setPlanImageDataUrl] = useState('');
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

  // Always compute hooks at top-level (React rules-of-hooks).
  const allPointsSorted = useMemo(() => {
    if (!currentPlan) return [];
    return [...currentPlan.points].sort((a, b) => a.pointNumber - b.pointNumber);
  }, [currentPlan]);

  const filteredForAction = useMemo(() => {
    const q = actionQuery.trim().toLowerCase();
    return allPointsSorted.filter((p) => {
      if (q) {
        const hay = `${p.pointNumber} ${p.title} ${p.description || ''} ${p.room || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (actionCategory !== 'all' && p.category !== actionCategory) return false;
      return true;
    });
  }, [allPointsSorted, actionQuery, actionCategory]);

  const byStatus = useMemo(
    () => ({
      a_faire: filteredForAction.filter((p) => p.status === 'a_faire'),
      en_cours: filteredForAction.filter((p) => p.status === 'en_cours'),
      termine: filteredForAction.filter((p) => p.status === 'termine'),
    }),
    [filteredForAction]
  );

  const completionRate = useMemo(() => {
    if (!currentPlan) return 0;
    const totalPoints = currentPlan.points.length;
    if (totalPoints === 0) return 0;
    const donePoints = currentPlan.points.filter((p) => p.status === 'termine').length;
    return Math.round((donePoints / totalPoints) * 100);
  }, [currentPlan]);

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
        // Ensure we have the site context (for breadcrumbs/back)
        if (!currentSite || currentSite.id !== plan.siteId) {
          try {
            const site = await sitesApi.getById(plan.siteId);
            setCurrentSite(site);
            setSitePlans(site.plans || []);
          } catch {
            // Fallback: minimal site context from the plan payload.
            setCurrentSite({
              id: plan.siteId,
              siteName: plan.siteName,
              address: plan.address,
              createdAt: plan.createdAt,
              updatedAt: plan.updatedAt,
            });
            // If we're resuming, we can skip the plans list refresh (it will be loaded on demand).
            if (!opts?.fromResume) {
              await refreshCurrentSitePlans(plan.siteId);
            }
          }
        }

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
    },
    [currentSite, refreshCurrentSitePlans, toast]
  );

  // Resume: open a specific plan (and point) when returning from another flow (PDF/report)
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

  // Upload handlers
  const handleUploadFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setPlanImageDataUrl(dataUrl);
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
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
      setZoom(1);
      setViewerTab('PLAN');
      setActionQuery('');
      setActionCategory('all');
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      setClickPosition(null);
      // Reset upload form
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

  const handleCreateReportFromPoint = (point: ApiPlanPoint) => {
    if (!currentPlan || !onCreateReportFromPoint) return;
    onCreateReportFromPoint(currentPlan, point);
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
    const handleBackToSites = () => {
      setCurrentPlan(null);
      setCurrentSite(null);
      setSitePlans([]);
      setSubView('SITES');
      loadSites();
    };

    const handleBackToSite = () => {
      setCurrentPlan(null);
      setPanelMode('closed');
      setSelectedPoint(null);
      setEditingPoint(null);
      setClickPosition(null);
      setSubView('SITE');
      refreshCurrentSitePlans();
      loadSites();
    };

    const handleOpenCreateSite = () => {
      setSiteNameInput('');
      setSiteAddressInput('');
      setSubView('CREATE_SITE');
    };

    const handleOpenUploadPlan = () => {
      if (!currentSite) return;
      setPlanNameInput('Plan principal');
      setPlanImageDataUrl('');
      setSubView('UPLOAD_PLAN');
    };

    // === RENDER ===

    // SITES view
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
                <button type="button" className="btn btn--primary" onClick={handleOpenCreateSite}>
                  <Plus size={16} /> Nouveau chantier
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
                        <button
                          className="btn btn--ghost btn-danger-ghost"
                          onClick={(e) => handleDeleteSite(site.id, e)}
                        >
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

            {loadingPlan && (
              <div className="modal-overlay">
                <div className="modal-loading">
                  <Loader2 size={32} className="spin" />
                  <p className="modal-loading__text">Chargement du plan...</p>
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

    // CREATE_SITE view
    if (subView === 'CREATE_SITE') {
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
                <input
                  type="text"
                  className="input"
                  value={siteNameInput}
                  onChange={(e) => setSiteNameInput(e.target.value)}
                  placeholder="Ex: Residence Les Cerisiers"
                />
              </div>

              <div className="form-field">
                <label>Adresse</label>
                <input
                  type="text"
                  className="input"
                  value={siteAddressInput}
                  onChange={(e) => setSiteAddressInput(e.target.value)}
                  placeholder="Ex: 12 rue des Lilas, 75001 Paris"
                />
              </div>

              <button
                className="btn btn--primary form-actions--full"
                onClick={handleCreateSiteSubmit}
                disabled={!siteNameInput.trim() || uploading}
              >
                {uploading ? <><Loader2 size={16} className="spin" /> Creation...</> : 'Creer le chantier'}
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

    // SITE view
    if (subView === 'SITE') {
      if (!currentSite) {
        return (
          <>
            <div className="view">
              <div className="view__top">
                <button type="button" onClick={handleBackToSites} className="link-btn">
                  <ArrowLeft size={16} /> Chantiers
                </button>
              </div>
              <div className="card">
                <EmptyState icon={Building2} title="Chantier introuvable." compact />
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

      return (
        <>
          <div className="view">
            <div className="view__top">
              <button type="button" onClick={handleBackToSites} className="link-btn">
                <ArrowLeft size={16} /> Chantiers
              </button>
            </div>

            <div className="card">
              <PageHeader
                title={currentSite.siteName}
                icon={Building2}
                subtitle={currentSite.address || 'Adresse non renseignée'}
                compact
              >
                <div className="card-actions">
                  <button
                    className="btn btn--ghost btn-danger-ghost"
                    onClick={(e) => handleDeleteSite(currentSite.id, e)}
                    title="Supprimer le chantier"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button type="button" className="btn btn--primary" onClick={handleOpenUploadPlan}>
                    <Plus size={16} /> Ajouter un plan
                  </button>
                </div>
              </PageHeader>

              {loadingSite ? (
                <LoadingState text="Chargement..." />
              ) : sitePlans.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="Aucun plan pour ce chantier."
                  hint='Cliquez sur "Ajouter un plan" pour commencer.'
                />
              ) : (
                <div className="plan-list">
                  {sitePlans.map((plan) => (
                    <div key={plan.id} className="plan-card" onClick={() => openPlan(plan.id)}>
                      <div className="plan-card__info">
                        <span className="plan-card__name">{plan.planName}</span>
                        <span className="plan-card__meta">
                          {plan.pointsCount} point(s) · {new Date(plan.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="plan-card__badge">
                        <span className="badge badge--info">{plan.pointsCount} point(s)</span>
                        <button
                          className="btn btn--ghost btn-danger-ghost"
                          onClick={(e) => handleDeletePlan(plan.id, e)}
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
                <div className="modal-loading">
                  <Loader2 size={32} className="spin" />
                  <p className="modal-loading__text">Chargement du plan...</p>
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

    // UPLOAD_PLAN view
    if (subView === 'UPLOAD_PLAN') {
      if (!currentSite) {
        return (
          <>
            <div className="view">
              <div className="view__top">
                <button type="button" onClick={handleBackToSites} className="link-btn">
                  <ArrowLeft size={16} /> Chantiers
                </button>
              </div>
              <div className="card">
                <EmptyState icon={Layers} title="Veuillez d'abord sélectionner un chantier." compact />
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

      return (
        <>
          <div className="view">
            <div className="view__top">
              <button type="button" onClick={() => setSubView('SITE')} className="link-btn">
                <ArrowLeft size={16} /> Retour chantier
              </button>
            </div>

            <div className="card">
              <PageHeader title="Ajouter un plan" icon={FilePlus} compact />

              <div className="plan-upload">
                <div className="form-field">
                  <label>Nom du plan *</label>
                  <input
                    type="text"
                    className="input"
                    value={planNameInput}
                    onChange={(e) => setPlanNameInput(e.target.value)}
                    placeholder="Ex: RDC, Etage 1, Sous-sol..."
                  />
                </div>

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
                      onDrop={handleUploadDrop}
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      <div className="dropzone__icon"><Upload size={28} /></div>
                      <p className="dropzone__title">Deposez le plan ou cliquez pour importer</p>
                      <p className="dropzone__hint">Formats JPG, PNG</p>
                    </div>
                  )}
                </div>

                <button
                  className="btn btn--primary form-actions--full"
                  onClick={handleUploadPlanSubmit}
                  disabled={!planNameInput.trim() || !planImageDataUrl || uploading}
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

    return (
      <>
          <div className="view">
          <div className="view__top">
            <button type="button" onClick={handleBackToSite} className="link-btn">
              <ArrowLeft size={16} /> Retour chantier
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {onStartReportFromPlan && (
                <button
                  className="btn btn--ghost"
                  onClick={() => onStartReportFromPlan(currentPlan)}
                  type="button"
                >
                  <Camera size={16} /> Nouveau rapport
                </button>
              )}
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
                <div className="section-header">
                  <div>
                    <h2 className="section-header__title">{currentPlan.siteName}</h2>
                    <p className="section-header__meta">
                      <Layers size={14} className="icon-inline" />
                      {currentPlan.planName}
                      {currentPlan.address ? ` · ${currentPlan.address}` : ''}
                    </p>
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
                      <button type="button" className="btn btn--ghost" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} title="Zoom +">
                        <ZoomIn size={18} />
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} title="Zoom -">
                        <ZoomOut size={18} />
                      </button>
                      <span className="zoom-indicator">
                        {Math.round(zoom * 100)}%
                      </span>
                    </div>

                    <div
                      className="plan-viewer__canvas transform-zoom"
                      style={{ transform: `scale(${zoom})` }}
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

                  <p className="hint-text">
                    Cliquez sur le plan pour ajouter un point
                  </p>

                  {/* Points list */}
                  {currentPlan.points.length > 0 && (
                    <div className="points-section">
                      <h3 className="points-section__title">
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
                              className={`plan-points-list__number bg-status-${pt.status}`}
                            >
                              {pt.pointNumber}
                            </div>
                            <div className="plan-points-list__content">
                              <div className="plan-points-list__title">{pt.title}</div>
                              <div className="plan-points-list__badges">
                                <span className="badge badge--info badge-sm">
                                  {categoryLabels[pt.category] || pt.category}
                                </span>
                                <span className={`badge ${statusBadge[pt.status]} badge-sm`}>
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

                  <div className="plan-action__hint action-hint">
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
                                      className={`plan-action-card__num bg-status-${pt.status}`}
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
            onCreateReport={onCreateReportFromPoint ? handleCreateReportFromPoint : undefined}
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
