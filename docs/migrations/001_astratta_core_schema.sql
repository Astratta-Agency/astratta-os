-- =====================================================================
-- Astratta OS — Foundational Core Schema (Migration 001)
-- Apply in your Supabase project (SQL Editor or `supabase db push`).
-- Multi-tenant: workspaces (agency) + clients (portal) with strict RLS.
-- All membership/role checks go through SECURITY DEFINER helpers to
-- avoid recursive RLS evaluation.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums -----------------------------------------------------
do $$ begin
  create type public.subscription_status as enum ('trialing','active','past_due','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_role as enum ('owner','team_member','collaborator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active','invited','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('prospect','active','paused','churned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_user_role as enum ('client_admin','client_viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_type as enum ('web_dev','social_media','paid_ads','graphic_design','branding','audit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum ('planning','in_progress','paused','delivered','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo','doing','review','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('p0','p1','p2','p3');
exception when duplicate_object then null; end $$;

-- ---------- Utility functions ----------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.generate_slug(_input text)
returns text language sql immutable as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(_input,'')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- =====================================================================
-- TABLES
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#5140f2',
  secondary_color text not null default '#ff7503',
  billing_email text,
  subscription_status public.subscription_status not null default 'trialing',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'team_member',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user_workspace
  on public.workspace_members (user_id, workspace_id);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  industry text,
  location text not null default 'Dallas-Fort Worth, TX',
  website text,
  status public.client_status not null default 'prospect',
  health_score int check (health_score is null or (health_score between 0 and 100)),
  notes_internal text,
  logo_url text,
  brand_primary_color text default '#5140f2',
  brand_secondary_color text default '#ff7503',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index if not exists idx_clients_workspace_status
  on public.clients (workspace_id, status);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_contacts_client on public.client_contacts (client_id);

create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.client_user_role not null default 'client_viewer',
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);
create index if not exists idx_client_users_user_client
  on public.client_users (user_id, client_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  type public.project_type not null,
  status public.project_status not null default 'planning',
  start_date date,
  end_date date,
  budget_amount numeric(12,2) check (budget_amount is null or budget_amount >= 0),
  retainer_monthly boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists idx_projects_workspace_client_status
  on public.projects (workspace_id, client_id, status);
create index if not exists idx_projects_client on public.projects (client_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'p2',
  due_date date,
  related_post_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_workspace_status_due
  on public.tasks (workspace_id, status, due_date);
create index if not exists idx_tasks_assigned_status
  on public.tasks (assigned_to, status);

-- =====================================================================
-- updated_at triggers
-- =====================================================================
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Auth user → profile bootstrap
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Workspace → owner-membership bootstrap
-- =====================================================================
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.created_by is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (new.id, new.created_by, 'owner', 'active')
    on conflict (workspace_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspaces_owner_bootstrap on public.workspaces;
create trigger trg_workspaces_owner_bootstrap
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- =====================================================================
-- SECURITY DEFINER helpers (recursion-safe)
-- =====================================================================
create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _role public.workspace_role)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = _role
  );
$$;

create or replace function public.is_workspace_owner(_workspace_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.has_workspace_role(_workspace_id, 'owner');
$$;

create or replace function public.can_write_workspace(_workspace_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner','team_member')
  );
$$;

create or replace function public.is_client_user(_client_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.client_users
    where client_id = _client_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_client_admin(_client_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.client_users
    where client_id = _client_id and user_id = auth.uid() and role = 'client_admin'
  );
$$;

create or replace function public.client_in_member_workspace(_client_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.clients c
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where c.id = _client_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.shares_workspace_with(_other_user uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = _other_user
      and me.status = 'active'
      and them.status = 'active'
  );
$$;

create or replace function public.profile_visible_to_client_user(_profile_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.client_users cu
    join public.clients c on c.id = cu.client_id
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where cu.user_id = auth.uid()
      and wm.user_id = _profile_id
      and wm.status = 'active'
  );
$$;

-- =====================================================================
-- ENABLE + FORCE RLS
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.clients             enable row level security;
alter table public.client_contacts     enable row level security;
alter table public.client_users        enable row level security;
alter table public.projects            enable row level security;
alter table public.tasks               enable row level security;

alter table public.profiles            force row level security;
alter table public.workspaces          force row level security;
alter table public.workspace_members   force row level security;
alter table public.clients             force row level security;
alter table public.client_contacts     force row level security;
alter table public.client_users        force row level security;
alter table public.projects            force row level security;
alter table public.tasks               force row level security;

-- =====================================================================
-- POLICIES
-- =====================================================================

-- profiles
drop policy if exists "profiles_select_self_or_shared" on public.profiles;
create policy "profiles_select_self_or_shared" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.shares_workspace_with(id)
    or public.profile_visible_to_client_user(id)
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_self" on public.workspaces;
create policy "workspaces_insert_self" on public.workspaces for insert to authenticated
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner" on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner" on public.workspaces for delete to authenticated
  using (public.is_workspace_owner(id));

-- workspace_members
drop policy if exists "members_select_member_or_self" on public.workspace_members;
create policy "members_select_member_or_self" on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "members_insert_owner" on public.workspace_members;
create policy "members_insert_owner" on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "members_update_owner" on public.workspace_members;
create policy "members_update_owner" on public.workspace_members for update to authenticated
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

drop policy if exists "members_delete_owner" on public.workspace_members;
create policy "members_delete_owner" on public.workspace_members for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- clients
drop policy if exists "clients_select_member_or_portal" on public.clients;
create policy "clients_select_member_or_portal" on public.clients for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_client_user(id));

drop policy if exists "clients_insert_writer" on public.clients;
create policy "clients_insert_writer" on public.clients for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "clients_update_writer" on public.clients;
create policy "clients_update_writer" on public.clients for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));

drop policy if exists "clients_delete_writer" on public.clients;
create policy "clients_delete_writer" on public.clients for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- client_contacts
drop policy if exists "contacts_select_member_or_portal" on public.client_contacts;
create policy "contacts_select_member_or_portal" on public.client_contacts for select to authenticated
  using (public.client_in_member_workspace(client_id) or public.is_client_user(client_id));

drop policy if exists "contacts_write_member" on public.client_contacts;
create policy "contacts_write_member" on public.client_contacts for all to authenticated
  using (
    exists (select 1 from public.clients c
            where c.id = client_contacts.client_id
              and public.can_write_workspace(c.workspace_id))
  )
  with check (
    exists (select 1 from public.clients c
            where c.id = client_contacts.client_id
              and public.can_write_workspace(c.workspace_id))
  );

-- client_users
drop policy if exists "client_users_select_member_or_self" on public.client_users;
create policy "client_users_select_member_or_self" on public.client_users for select to authenticated
  using (user_id = auth.uid() or public.client_in_member_workspace(client_id));

drop policy if exists "client_users_write_member" on public.client_users;
create policy "client_users_write_member" on public.client_users for all to authenticated
  using (
    exists (select 1 from public.clients c
            where c.id = client_users.client_id
              and public.can_write_workspace(c.workspace_id))
  )
  with check (
    exists (select 1 from public.clients c
            where c.id = client_users.client_id
              and public.can_write_workspace(c.workspace_id))
  );

-- projects
drop policy if exists "projects_select_member_or_portal" on public.projects;
create policy "projects_select_member_or_portal" on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_client_user(client_id));

drop policy if exists "projects_insert_writer" on public.projects;
create policy "projects_insert_writer" on public.projects for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "projects_update_writer" on public.projects;
create policy "projects_update_writer" on public.projects for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));

drop policy if exists "projects_delete_writer" on public.projects;
create policy "projects_delete_writer" on public.projects for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- tasks (internal only — NOT exposed to portal)
drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member" on public.tasks for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_update_assignee_or_writer" on public.tasks;
create policy "tasks_update_assignee_or_writer" on public.tasks for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (assigned_to = auth.uid() or public.can_write_workspace(workspace_id))
  )
  with check (
    public.is_workspace_member(workspace_id)
    and (assigned_to = auth.uid() or public.can_write_workspace(workspace_id))
  );

drop policy if exists "tasks_delete_writer" on public.tasks;
create policy "tasks_delete_writer" on public.tasks for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- =====================================================================
-- DONE
-- =====================================================================
