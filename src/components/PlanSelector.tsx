import React, { useState, useEffect } from 'react';
import { ArrowLeft, Map, Plus, Loader2, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { plansApi, ApiPlanListItem } from '../services/api';

import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from '../store/useAppStore';

export const PlanSelector: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedPlan } = useAppStore();
  const { offlineState, getCachedPlans } = useAuth();
  const [plans, setPlans] = useState<ApiPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, [offlineState.isOnline]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      if (offlineState.isOnline) {
        const data = await plansApi.getAll();
        setPlans(data);
      } else {
        const cached = await getCachedPlans();
        // Convert CachedPlan to ApiPlanListItem format
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
      setError('Impossible de charger les plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planItem: ApiPlanListItem) => {
    try {
      setSelectedPlanId(planItem.id);

      if (offlineState.isOnline) {
        const fullPlan = await plansApi.getById(planItem.id);
        setSelectedPlan(fullPlan);
        navigate('/camera');
      } else {
        const cached = await getCachedPlans();
        const fullPlan = cached.find((c: any) => c.id === planItem.id);
        if (fullPlan) {
          setSelectedPlan({
            id: fullPlan.id,
            siteName: fullPlan.siteName,
            address: fullPlan.address,
            imageDataUrl: fullPlan.imageDataUrl,
            points: [], // Will be hydrated in PlanView
            pointsCount: fullPlan.pointsCount,
            createdAt: fullPlan.updatedAt,
            updatedAt: fullPlan.updatedAt
          });
          navigate('/camera');
        } else {
          throw new Error('Plan non mis en cache');
        }
      }
    } catch (err) {
      setError('Impossible de charger le plan. Ce plan n\'est peut-être pas disponible hors ligne.');
      setSelectedPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="view">
        <div className="view__top">
          <button onClick={() => navigate(-1)} className="link-btn">
            <ArrowLeft size={16} /> Retour
          </button>
        </div>
        <div className="card analysis text-center py-12">
          <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#ffb703]" />
          <p>Chargement des chantiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view__top">
        <button onClick={() => navigate(-1)} className="link-btn">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="stepper">
          <span className="stepper__item stepper__item--active">1. Choisir un chantier</span>
          <span className="stepper__item">2. Prendre des photos</span>
          <span className="stepper__item">3. Générer le rapport</span>
        </div>
      </div>

      <section className="card">
        <div className="history__header mb-6">
          <div>
            <h2 className="text-xl font-bold">Sélectionner un chantier</h2>
            <p className="text-sm text-text-muted mt-1">
              Vous devez d'abord choisir un chantier pour créer un rapport
            </p>
          </div>
          <button className="btn btn--ghost" onClick={() => navigate('/plans')}>
            <Plus size={16} />
            Gérer les plans
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center py-12">
            <Map size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
            <h3 className="text-lg font-semibold mb-2">Aucun chantier disponible</h3>
            <p className="text-sm text-text-muted mb-6">
              Vous devez d'abord créer un plan de chantier avant de pouvoir faire un rapport
            </p>
            <button className="btn btn--primary" onClick={() => navigate('/plans')}>
              <Plus size={18} />
              Créer un nouveau chantier
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`plan-card group cursor-pointer transition-all ${selectedPlanId === plan.id ? 'ring-2 ring-[#ffb703]' : ''
                  }`}
              >
                <div className="plan-card__info">
                  <span className="plan-card__name">{plan.siteName}</span>
                  <span className="plan-card__meta">
                    {plan.address || 'Pas d\'adresse'} • {plan.pointsCount || 0} points
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${plan.pointsCount > 0 ? 'badge--info' : 'badge--warning'}`}>
                    <FileText size={12} />
                    {plan.pointsCount || 0} points
                  </span>
                  <ChevronRight
                    size={20}
                    className="text-text-muted group-hover:text-[#ffb703] transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {plans.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <button className="btn btn--ghost w-full" onClick={() => navigate('/plans')}>
              <Plus size={16} />
              Créer un nouveau chantier
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
