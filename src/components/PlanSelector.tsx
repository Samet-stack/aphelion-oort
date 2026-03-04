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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="card analysis">
          <Loader2 size={38} className="spin" />
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

      <section className="card plan-selector">
        <div className="plan-selector__header">
          <div className="plan-selector__title-wrap">
            <h2>Selectionner un chantier</h2>
            <p>Choisissez un plan pour lancer la capture et preparer votre rapport.</p>
          </div>
          <button className="btn btn--ghost" onClick={() => navigate('/plans')}>
            <Plus size={16} />
            Gérer les plans
          </button>
        </div>

        <div className="plan-selector__meta">
          <span className="badge badge--info">{plans.length} chantier(s) disponible(s)</span>
          {!offlineState.isOnline && <span className="badge badge--warning">Mode hors-ligne</span>}
        </div>

        {error && (
          <div className="alert alert--danger">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="plan-selector__empty">
            <Map size={50} />
            <h3>Aucun chantier disponible</h3>
            <p>
              Vous devez d'abord créer un plan de chantier avant de pouvoir faire un rapport
            </p>
            <button className="btn btn--primary" onClick={() => navigate('/plans')}>
              <Plus size={18} />
              Créer un nouveau chantier
            </button>
          </div>
        ) : (
          <div className="plan-selector__list">
            {plans.map((plan) => (
              <button
                type="button"
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`plan-card ${selectedPlanId === plan.id ? 'plan-card--active' : ''
                  }`}
                aria-label={`Selectionner le chantier ${plan.siteName}`}
              >
                <div className="plan-card__info">
                  <span className="plan-card__name">{plan.siteName}</span>
                  <span className="plan-card__meta">
                    {plan.address || 'Pas d\'adresse'} • {plan.pointsCount || 0} points
                  </span>
                </div>
                <div className="plan-card__right">
                  <span className={`badge ${plan.pointsCount > 0 ? 'badge--info' : 'badge--warning'}`}>
                    <FileText size={12} />
                    {plan.pointsCount || 0} points
                  </span>
                  <ChevronRight
                    size={20}
                    className="plan-card__arrow"
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {plans.length > 0 && (
          <div className="plan-selector__footer">
            <button className="btn btn--ghost" onClick={() => navigate('/plans')}>
              <Plus size={16} />
              Créer un nouveau chantier
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
