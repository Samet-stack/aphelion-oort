-- SiteFlow Pro - Schema Supabase (PostgreSQL)
-- Compatible avec les tables du backend actuel, avec noms snake_case.
-- Colle ce script dans Supabase SQL Editor.

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
  last_login_at timestamptz,
  reset_password_token text unique,
  reset_password_expires timestamptz
);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

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
  client_signature text
);

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
create index if not exists idx_extra_report on public.extra_works(report_id);
create index if not exists idx_extra_user on public.extra_works(user_id);
create index if not exists idx_shares_report on public.shares(report_id);
create index if not exists idx_shares_owner on public.shares(owner_id);
create index if not exists idx_shares_recipient_email on public.shares(shared_with_email);
create index if not exists idx_shares_recipient_id on public.shares(shared_with_id);
create index if not exists idx_shares_status on public.shares(status);
create index if not exists idx_email_verifications_user on public.email_verifications(user_id);
create index if not exists idx_email_verifications_token_unused on public.email_verifications(token) where used = false;

-- Plans (plans de chantier)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  site_name text not null,
  address text,
  image_data_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
before update on public.plans
for each row
execute function public.set_updated_at();

-- Plan Points (points interactifs sur un plan)
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

create index if not exists idx_plans_user on public.plans(user_id);
create index if not exists idx_plans_created on public.plans(created_at desc);
create index if not exists idx_plan_points_plan on public.plan_points(plan_id);
create index if not exists idx_plan_points_user on public.plan_points(user_id);

commit;

-- ==========================================================
-- RLS OPTIONNEL (active seulement si tu utilises Supabase Auth)
-- ==========================================================
-- Si ton backend utilise la SERVICE ROLE key, RLS est bypass.
-- Si tu utilises le client Supabase côté front avec auth, active ce bloc.
--
-- alter table public.users enable row level security;
-- alter table public.reports enable row level security;
-- alter table public.extra_works enable row level security;
-- alter table public.shares enable row level security;
-- alter table public.email_verifications enable row level security;
--
-- drop policy if exists users_select_own on public.users;
-- create policy users_select_own on public.users
-- for select to authenticated
-- using (id = auth.uid());
--
-- drop policy if exists users_insert_own on public.users;
-- create policy users_insert_own on public.users
-- for insert to authenticated
-- with check (id = auth.uid());
--
-- drop policy if exists users_update_own on public.users;
-- create policy users_update_own on public.users
-- for update to authenticated
-- using (id = auth.uid())
-- with check (id = auth.uid());
--
-- drop policy if exists reports_select_owner_or_shared on public.reports;
-- create policy reports_select_owner_or_shared on public.reports
-- for select to authenticated
-- using (
--   user_id = auth.uid()
--   or exists (
--     select 1
--     from public.shares s
--     where s.report_id = reports.id
--       and s.status = 'active'
--       and (
--         s.shared_with_id = auth.uid()
--         or lower(s.shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
--       )
--   )
-- );
--
-- drop policy if exists reports_insert_own on public.reports;
-- create policy reports_insert_own on public.reports
-- for insert to authenticated
-- with check (user_id = auth.uid());
--
-- drop policy if exists reports_update_own on public.reports;
-- create policy reports_update_own on public.reports
-- for update to authenticated
-- using (user_id = auth.uid())
-- with check (user_id = auth.uid());
--
-- drop policy if exists reports_delete_own on public.reports;
-- create policy reports_delete_own on public.reports
-- for delete to authenticated
-- using (user_id = auth.uid());
--
-- drop policy if exists extra_works_select_owner_or_shared on public.extra_works;
-- create policy extra_works_select_owner_or_shared on public.extra_works
-- for select to authenticated
-- using (
--   user_id = auth.uid()
--   or exists (
--     select 1
--     from public.reports r
--     join public.shares s on s.report_id = r.id and s.status = 'active'
--     where r.id = extra_works.report_id
--       and (
--         s.shared_with_id = auth.uid()
--         or lower(s.shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
--       )
--   )
-- );
--
-- drop policy if exists extra_works_insert_own on public.extra_works;
-- create policy extra_works_insert_own on public.extra_works
-- for insert to authenticated
-- with check (
--   user_id = auth.uid()
--   and exists (
--     select 1
--     from public.reports r
--     where r.id = extra_works.report_id
--       and r.user_id = auth.uid()
--   )
-- );
--
-- drop policy if exists extra_works_update_own on public.extra_works;
-- create policy extra_works_update_own on public.extra_works
-- for update to authenticated
-- using (user_id = auth.uid())
-- with check (user_id = auth.uid());
--
-- drop policy if exists extra_works_delete_own on public.extra_works;
-- create policy extra_works_delete_own on public.extra_works
-- for delete to authenticated
-- using (user_id = auth.uid());
--
-- drop policy if exists shares_select_owner_or_recipient on public.shares;
-- create policy shares_select_owner_or_recipient on public.shares
-- for select to authenticated
-- using (
--   owner_id = auth.uid()
--   or shared_with_id = auth.uid()
--   or lower(shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
-- );
--
-- drop policy if exists shares_insert_owner on public.shares;
-- create policy shares_insert_owner on public.shares
-- for insert to authenticated
-- with check (
--   owner_id = auth.uid()
--   and exists (
--     select 1
--     from public.reports r
--     where r.id = shares.report_id
--       and r.user_id = auth.uid()
--   )
-- );
--
-- drop policy if exists shares_delete_owner on public.shares;
-- create policy shares_delete_owner on public.shares
-- for delete to authenticated
-- using (owner_id = auth.uid());
--
-- drop policy if exists shares_update_recipient on public.shares;
-- create policy shares_update_recipient on public.shares
-- for update to authenticated
-- using (
--   status = 'pending'
--   and (
--     shared_with_id = auth.uid()
--     or lower(shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
--   )
-- )
-- with check (
--   (
--     shared_with_id = auth.uid()
--     or lower(shared_with_email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
--   )
--   and status in ('pending', 'active')
-- );
