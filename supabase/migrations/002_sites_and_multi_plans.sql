-- Migration: Introduire la notion de "chantier" (sites) + plusieurs plans par chantier
-- Objectifs:
-- - creer table public.sites
-- - ajouter plans.site_id + plans.plan_name
-- - migrer les plans existants (1 chantier par plan legacy, id reuse)
-- - ajouter reports.site_id (optionnel)

begin;

create extension if not exists pgcrypto;

-- 1) Table sites
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  site_name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sites_updated_at on public.sites;
create trigger trg_sites_updated_at
before update on public.sites
for each row
execute function public.set_updated_at();

create index if not exists idx_sites_user on public.sites(user_id);
create index if not exists idx_sites_created on public.sites(created_at desc);

-- 2) Plans: new columns
alter table public.plans
  add column if not exists site_id uuid references public.sites(id) on delete cascade;

alter table public.plans
  add column if not exists plan_name text;

update public.plans
set plan_name = 'Plan principal'
where plan_name is null;

alter table public.plans
  alter column plan_name set default 'Plan principal';

alter table public.plans
  alter column plan_name set not null;

create index if not exists idx_plans_site on public.plans(site_id);

-- 3) Migration legacy -> sites (reuse plans.id as sites.id)
insert into public.sites (id, user_id, site_name, address, created_at, updated_at)
select p.id, p.user_id, p.site_name, p.address, p.created_at, p.updated_at
from public.plans p
where p.site_id is null
  and not exists (select 1 from public.sites s where s.id = p.id);

update public.plans
set site_id = id
where site_id is null;

-- 4) Reports: optional link to site
alter table public.reports
  add column if not exists site_id uuid references public.sites(id) on delete set null;

create index if not exists idx_reports_site on public.reports(site_id);

-- 5) Update view used by some analytics/debugging
create or replace view public.reports_with_points as
select 
    r.*,
    pp.title as point_title,
    pp.status as point_status,
    pp.position_x,
    pp.position_y,
    pp.category as point_category,
    s.site_name as site_name_resolved,
    s.address as site_address_resolved,
    p.plan_name as plan_name
from public.reports r
left join public.plan_points pp on pp.id = r.plan_point_id
left join public.plans p on p.id = r.plan_id
left join public.sites s on s.id = p.site_id;

commit;

