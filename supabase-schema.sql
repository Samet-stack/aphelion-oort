-- ==========================================================
-- SiteFlow Pro - Schema Supabase Complet (PostgreSQL)
-- ==========================================================
-- Compatible avec le backend Node.js/Express existant
-- Noms en snake_case pour correspondre au mapping camelCase

begin;

-- ==========================================================
-- EXTENSIONS
-- ==========================================================
create extension if not exists pgcrypto;    -- Pour gen_random_uuid()
create extension if not exists citext;      -- Pour emails case-insensitive

-- ==========================================================
-- FONCTIONS UTILITAIRES
-- ==========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================================
-- TABLE: USERS
-- ==========================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password text not null,
  first_name text,
  last_name text,
  company_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  email_verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- ==========================================================
-- TABLE: SITES (Chantiers)
-- ==========================================================
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

-- ==========================================================
-- TABLE: PLANS (Plans de chantier)
-- ==========================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  plan_name text not null default 'Plan principal',
  site_name text not null,
  address text,
  image_data_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure new columns exist (legacy DBs)
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

-- One-time migration: create a site per legacy plan if site_id is missing.
insert into public.sites (id, user_id, site_name, address, created_at, updated_at)
select p.id, p.user_id, p.site_name, p.address, p.created_at, p.updated_at
from public.plans p
where p.site_id is null
  and not exists (select 1 from public.sites s where s.id = p.id);

update public.plans
set site_id = id
where site_id is null;

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
before update on public.plans
for each row
execute function public.set_updated_at();

-- ==========================================================
-- TABLE: PLAN_POINTS (Points interactifs sur un plan)
-- ==========================================================
create table if not exists public.plan_points (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position_x double precision not null,
  position_y double precision not null,
  title text not null,
  description text,
  category text not null default 'autre'
    check (category in ('radiateur','electricite','defaut','validation','plomberie','maconnerie','menuiserie','autre')),
  photo_data_url text not null,
  date_label text not null default to_char(now(), 'YYYY-MM-DD'),
  room text,
  status text not null default 'a_faire'
    check (status in ('a_faire','en_cours','termine')),
  point_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Contraintes de validation
  constraint chk_position_x check (position_x >= 0 and position_x <= 100),
  constraint chk_position_y check (position_y >= 0 and position_y <= 100)
);

drop trigger if exists trg_plan_points_updated_at on public.plan_points;
create trigger trg_plan_points_updated_at
before update on public.plan_points
for each row
execute function public.set_updated_at();

-- ==========================================================
-- TABLE: REPORTS (Rapports de chantier)
-- ==========================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  report_id text not null,
  created_at timestamptz not null default now(),
  date_label text,
  address text,
  coordinates text,
  accuracy double precision,
  location_source text,
  description text,
  image_data_url text,
  site_name text,
  operator_name text,
  client_name text,
  priority text check (priority in ('low', 'medium', 'high')),
  category text,
  integrity_hash text,
  client_signature text,
  site_id uuid references public.sites(id) on delete set null,
  -- Liens vers les plans/points (nouvelles colonnes)
  plan_id uuid references public.plans(id) on delete set null,
  plan_point_id uuid references public.plan_points(id) on delete set null
);

alter table public.reports
  add column if not exists site_id uuid references public.sites(id) on delete set null;

alter table public.reports
  add column if not exists plan_id uuid references public.plans(id) on delete set null;

alter table public.reports
  add column if not exists plan_point_id uuid references public.plan_points(id) on delete set null;

-- ==========================================================
-- TABLE: EXTRA_WORKS (Travaux supplémentaires)
-- ==========================================================
create table if not exists public.extra_works (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  description text not null,
  estimated_cost numeric(12,2) not null default 0 check (estimated_cost >= 0),
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high')),
  category text,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- TABLE: SHARES (Partages de rapports)
-- ==========================================================
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  shared_with_email citext not null,
  shared_with_id uuid references public.users(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  message text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint shares_unique_report_recipient unique (report_id, shared_with_email)
);

-- ==========================================================
-- TABLE: EMAIL_VERIFICATIONS
-- ==========================================================
create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  email citext not null,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- INDEXES - Performance
-- ==========================================================

-- Users
create index if not exists idx_users_email on public.users(email);

-- Plans
create index if not exists idx_plans_user on public.plans(user_id);
create index if not exists idx_plans_site on public.plans(site_id);
create index if not exists idx_plans_created on public.plans(created_at desc);

-- Sites
create index if not exists idx_sites_user on public.sites(user_id);
create index if not exists idx_sites_created on public.sites(created_at desc);

-- Plan Points
create index if not exists idx_plan_points_plan on public.plan_points(plan_id);
create index if not exists idx_plan_points_user on public.plan_points(user_id);
create index if not exists idx_plan_points_plan_number on public.plan_points(plan_id, point_number);

-- Reports
create index if not exists idx_reports_user on public.reports(user_id);
create index if not exists idx_reports_date on public.reports(created_at desc);
create index if not exists idx_reports_user_date on public.reports(user_id, created_at desc);
create index if not exists idx_reports_user_category on public.reports(user_id, category);
create index if not exists idx_reports_site on public.reports(site_id);
create index if not exists idx_reports_plan on public.reports(plan_id);
create index if not exists idx_reports_plan_point on public.reports(plan_point_id);

-- Extra Works
create index if not exists idx_extra_report on public.extra_works(report_id);
create index if not exists idx_extra_user on public.extra_works(user_id);

-- Shares
create index if not exists idx_shares_report on public.shares(report_id);
create index if not exists idx_shares_owner on public.shares(owner_id);
create index if not exists idx_shares_recipient_email on public.shares(shared_with_email);
create index if not exists idx_shares_recipient_id on public.shares(shared_with_id);
create index if not exists idx_shares_status on public.shares(status);

-- Email Verifications
create index if not exists idx_email_verifications_user on public.email_verifications(user_id);
create index if not exists idx_email_verifications_token_unused on public.email_verifications(token) where used = false;

commit;

-- ==========================================================
-- RLS (Row Level Security) - Optionnel
-- ==========================================================
-- Active ces lignes UNIQUEMENT si tu utilises Supabase Auth côté client
-- Si ton backend Node.js utilise la SERVICE ROLE key, RLS est bypassé

/*
-- Activer RLS sur toutes les tables
alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.plan_points enable row level security;
alter table public.reports enable row level security;
alter table public.extra_works enable row level security;
alter table public.shares enable row level security;
alter table public.email_verifications enable row level security;

-- Users: sélection/mise à jour uniquement de son propre compte
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select to authenticated
using (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Plans: CRUD uniquement sur ses propres plans
drop policy if exists plans_select_own on public.plans;
create policy plans_select_own on public.plans
for select to authenticated
using (user_id = auth.uid());

drop policy if exists plans_insert_own on public.plans;
create policy plans_insert_own on public.plans
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists plans_update_own on public.plans;
create policy plans_update_own on public.plans
for update to authenticated
using (user_id = auth.uid());

drop policy if exists plans_delete_own on public.plans;
create policy plans_delete_own on public.plans
for delete to authenticated
using (user_id = auth.uid());

-- Plan Points: CRUD uniquement sur ses propres points
drop policy if exists plan_points_select_own on public.plan_points;
create policy plan_points_select_own on public.plan_points
for select to authenticated
using (user_id = auth.uid());

drop policy if exists plan_points_insert_own on public.plan_points;
create policy plan_points_insert_own on public.plan_points
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists plan_points_update_own on public.plan_points;
create policy plan_points_update_own on public.plan_points
for update to authenticated
using (user_id = auth.uid());

drop policy if exists plan_points_delete_own on public.plan_points;
create policy plan_points_delete_own on public.plan_points
for delete to authenticated
using (user_id = auth.uid());

-- Reports: CRUD uniquement sur ses propres rapports
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
for select to authenticated
using (user_id = auth.uid());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists reports_update_own on public.reports;
create policy reports_update_own on public.reports
for update to authenticated
using (user_id = auth.uid());

drop policy if exists reports_delete_own on public.reports;
create policy reports_delete_own on public.reports
for delete to authenticated
using (user_id = auth.uid());

-- Extra Works: CRUD uniquement sur ses propres travaux
drop policy if exists extra_works_select_own on public.extra_works;
create policy extra_works_select_own on public.extra_works
for select to authenticated
using (user_id = auth.uid());

drop policy if exists extra_works_insert_own on public.extra_works;
create policy extra_works_insert_own on public.extra_works
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists extra_works_update_own on public.extra_works;
create policy extra_works_update_own on public.extra_works
for update to authenticated
using (user_id = auth.uid());

drop policy if exists extra_works_delete_own on public.extra_works;
create policy extra_works_delete_own on public.extra_works
for delete to authenticated
using (user_id = auth.uid());

-- Shares: voir les partages où on est propriétaire ou destinataire
drop policy if exists shares_select_owner_or_recipient on public.shares;
create policy shares_select_owner_or_recipient on public.shares
for select to authenticated
using (
  owner_id = auth.uid()
  or shared_with_id = auth.uid()
  or lower(shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists shares_insert_owner on public.shares;
create policy shares_insert_owner on public.shares
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists shares_delete_owner on public.shares;
create policy shares_delete_owner on public.shares
for delete to authenticated
using (owner_id = auth.uid());

-- Email Verifications: accès uniquement à ses propres tokens
drop policy if exists email_verifications_select_own on public.email_verifications;
create policy email_verifications_select_own on public.email_verifications
for select to authenticated
using (user_id = auth.uid());
*/

-- ==========================================================
-- NOTES
-- ==========================================================
-- 1. Les colonnes plan_id et plan_point_id dans reports permettent
--    de lier un rapport à un point spécifique sur un plan.
-- 
-- 2. Les contraintes chk_position_x/y assurent que les points
--    sont positionnés entre 0% et 100% sur le plan.
--
-- 3. Les indexes idx_reports_plan et idx_reports_plan_point
--    améliorent les performances des requêtes JOIN.
--
-- 4. Le RLS est commenté par défaut car le backend Node.js utilise
--    probablement la SERVICE ROLE key qui bypass RLS.
