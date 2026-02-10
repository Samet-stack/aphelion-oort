-- SiteFlow Pro - Schema Supabase (PostgreSQL)
-- Compatible avec les tables du backend actuel (Express), avec noms snake_case.
-- Colle ce script dans Supabase SQL Editor.
--
-- Note:
-- - Ce script est idempotent (CREATE IF NOT EXISTS / ALTER IF NOT EXISTS) et peut etre rejoue.
-- - Ordre des tables: on cree d'abord les dependances (sites/plans/points) avant reports.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

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
-- USERS
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
-- SITES (CHANTIERS)
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

create index if not exists idx_sites_user on public.sites(user_id);
create index if not exists idx_sites_created on public.sites(created_at desc);

-- ==========================================================
-- PLANS (PLANS D'UN CHANTIER)
-- ==========================================================
-- Legacy columns kept for backward compatibility: site_name, address.
-- New model: plans belong to a "site" via site_id, and have plan_name.

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

-- Ensure new columns exist (existing DBs created with the legacy schema)
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
-- We reuse the legacy plan.id as the site.id to keep links stable.
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

create index if not exists idx_plans_user on public.plans(user_id);
create index if not exists idx_plans_site on public.plans(site_id);
create index if not exists idx_plans_created on public.plans(created_at desc);

-- ==========================================================
-- PLAN POINTS (POINTS SUR UN PLAN)
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
  date_label text not null,
  room text,
  status text not null default 'a_faire'
    check (status in ('a_faire','en_cours','termine')),
  point_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_plan_points_updated_at on public.plan_points;
create trigger trg_plan_points_updated_at
before update on public.plan_points
for each row
execute function public.set_updated_at();

create index if not exists idx_plan_points_plan on public.plan_points(plan_id);
create index if not exists idx_plan_points_user on public.plan_points(user_id);

-- ==========================================================
-- REPORTS + EXTRA WORKS + SHARES + EMAIL VERIFICATIONS
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
  -- Liaison avec les chantiers/plans (optionnel)
  site_id uuid references public.sites(id) on delete set null,
  plan_point_id uuid references public.plan_points(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null
);

alter table public.reports
  add column if not exists site_id uuid references public.sites(id) on delete set null;

alter table public.reports
  add column if not exists plan_point_id uuid references public.plan_points(id) on delete set null;

alter table public.reports
  add column if not exists plan_id uuid references public.plans(id) on delete set null;

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

create index if not exists idx_reports_user on public.reports(user_id);
create index if not exists idx_reports_date on public.reports(created_at desc);
create index if not exists idx_reports_user_category on public.reports(user_id, category);
create index if not exists idx_reports_site on public.reports(site_id);
create index if not exists idx_reports_plan_point on public.reports(plan_point_id);
create index if not exists idx_reports_plan on public.reports(plan_id);
create index if not exists idx_extra_report on public.extra_works(report_id);
create index if not exists idx_extra_user on public.extra_works(user_id);
create index if not exists idx_shares_report on public.shares(report_id);
create index if not exists idx_shares_owner on public.shares(owner_id);
create index if not exists idx_shares_recipient_email on public.shares(shared_with_email);
create index if not exists idx_shares_recipient_id on public.shares(shared_with_id);
create index if not exists idx_shares_status on public.shares(status);
create index if not exists idx_email_verifications_user on public.email_verifications(user_id);
create index if not exists idx_email_verifications_token_unused on public.email_verifications(token) where used = false;

commit;

-- ==========================================================
-- RLS OPTIONNEL (active seulement si tu utilises Supabase Auth)
-- ==========================================================
-- Si ton backend utilise la SERVICE ROLE key, RLS est bypass.
-- Si tu utilises le client Supabase cote front avec auth, active ce bloc.

