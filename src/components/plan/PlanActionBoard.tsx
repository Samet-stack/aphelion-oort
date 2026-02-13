import React, { useMemo } from 'react';
import { Search, Plus, Play, CheckCircle2, ChevronRight } from 'lucide-react';
import { ApiPlanPoint } from '../../services/api';

interface PlanActionBoardProps {
    currentPlanPoints: ApiPlanPoint[];
    selectedPointId: string | null;
    isPanelOpen: boolean;
    onSelectPoint: (point: ApiPlanPoint) => void;
    onAddPointClick: () => void;
    onUpdateStatus: (pointId: string, status: ApiPlanPoint['status']) => void;
}



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

export const PlanActionBoard: React.FC<PlanActionBoardProps> = ({
    currentPlanPoints,
    selectedPointId,
    isPanelOpen,
    onSelectPoint,
    onAddPointClick,
    onUpdateStatus,
}) => {
    const [actionQuery, setActionQuery] = React.useState('');
    const [actionCategory, setActionCategory] = React.useState<'all' | string>('all');

    const allPointsSorted = useMemo(() => {
        return [...currentPlanPoints].sort((a, b) => a.pointNumber - b.pointNumber);
    }, [currentPlanPoints]);

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

    return (
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
                    onClick={onAddPointClick}
                    type="button"
                    title="Ajouter un point en cliquant sur le plan"
                >
                    <Plus size={16} /> Ajouter sur le plan
                </button>
            </div>

            <div className="plan-action__hint action-hint">
                Affichage: <strong>{filteredForAction.length}</strong> / {currentPlanPoints.length} point(s)
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
                                                className={`plan-action-card${selectedPointId === pt.id && isPanelOpen ? ' plan-action-card--active' : ''}`}
                                                onClick={() => onSelectPoint(pt)}
                                            >
                                                <div className={`plan-action-card__num bg-status-${pt.status}`}>
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
                                                            onUpdateStatus(pt.id, next.to);
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
    );
};
