-- Migration: Lier les rapports aux points de plan
-- Permet de savoir si un rapport est lié à un point spécifique sur un plan

begin;

-- Ajouter la colonne plan_point_id à la table reports
alter table public.reports 
add column if not exists plan_point_id uuid references public.plan_points(id) on delete set null;

-- Ajouter la colonne plan_id pour faciliter les requêtes
alter table public.reports 
add column if not exists plan_id uuid references public.plans(id) on delete set null;

-- Index pour les performances
create index if not exists idx_reports_plan_point on public.reports(plan_point_id);
create index if not exists idx_reports_plan on public.reports(plan_id);

-- Vue pour récupérer les rapports avec les infos du point associé
create or replace view public.reports_with_points as
select 
    r.*,
    pp.title as point_title,
    pp.status as point_status,
    pp.position_x,
    pp.position_y,
    pp.category as point_category,
    p.site_name as plan_site_name,
    p.address as plan_address
from public.reports r
left join public.plan_points pp on pp.id = r.plan_point_id
left join public.plans p on p.id = r.plan_id;

commit;
