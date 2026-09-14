-- 15. Módulo Equipo
-- Extend workspace_members with job title, weekly capacity, and hourly rate
-- (rate mainly relevant for role='collaborator' / freelancers).
alter table public.workspace_members
  add column if not exists title text,
  add column if not exists weekly_capacity_hours numeric(5,2) not null default 40,
  add column if not exists hourly_rate numeric(10,2);

-- Manual time log entries.
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  entry_date date not null default current_date,
  hours numeric(5,2) not null check (hours > 0),
  billable boolean not null default true,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_entries_user on public.time_entries (user_id, entry_date desc);
create index if not exists idx_time_entries_workspace on public.time_entries (workspace_id, entry_date desc);

alter table public.time_entries enable row level security;

drop policy if exists te_select on public.time_entries;
create policy te_select on public.time_entries
  for select to authenticated
  using (user_id = auth.uid() or is_workspace_owner(workspace_id));

drop policy if exists te_insert on public.time_entries;
create policy te_insert on public.time_entries
  for insert to authenticated
  with check (
    is_workspace_member(workspace_id)
    and (user_id = auth.uid() or is_workspace_owner(workspace_id))
  );

drop policy if exists te_update on public.time_entries;
create policy te_update on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or is_workspace_owner(workspace_id))
  with check (user_id = auth.uid() or is_workspace_owner(workspace_id));

drop policy if exists te_delete on public.time_entries;
create policy te_delete on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid() or is_workspace_owner(workspace_id));

-- Manual monthly performance reviews (quality rating), owner-authored.
create table if not exists public.member_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null, -- normalize to first-of-month
  quality_rating smallint not null check (quality_rating between 1 and 5),
  note text,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create index if not exists idx_member_reviews_user on public.member_performance_reviews (user_id, period desc);

alter table public.member_performance_reviews enable row level security;

drop policy if exists mpr_select on public.member_performance_reviews;
create policy mpr_select on public.member_performance_reviews
  for select to authenticated
  using (user_id = auth.uid() or is_workspace_owner(workspace_id));

drop policy if exists mpr_insert on public.member_performance_reviews;
create policy mpr_insert on public.member_performance_reviews
  for insert to authenticated
  with check (is_workspace_owner(workspace_id));

drop policy if exists mpr_update on public.member_performance_reviews;
create policy mpr_update on public.member_performance_reviews
  for update to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

drop policy if exists mpr_delete on public.member_performance_reviews;
create policy mpr_delete on public.member_performance_reviews
  for delete to authenticated
  using (is_workspace_owner(workspace_id));

-- Freelancer payment ledger (owner-managed; freelancer can view own rows).
create table if not exists public.freelancer_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  period_start date not null,
  period_end date not null,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_freelancer_payments_user on public.freelancer_payments (user_id, period_start desc);

alter table public.freelancer_payments enable row level security;

drop policy if exists fp_select on public.freelancer_payments;
create policy fp_select on public.freelancer_payments
  for select to authenticated
  using (user_id = auth.uid() or is_workspace_owner(workspace_id));

drop policy if exists fp_insert on public.freelancer_payments;
create policy fp_insert on public.freelancer_payments
  for insert to authenticated
  with check (is_workspace_owner(workspace_id));

drop policy if exists fp_update on public.freelancer_payments;
create policy fp_update on public.freelancer_payments
  for update to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

drop policy if exists fp_delete on public.freelancer_payments;
create policy fp_delete on public.freelancer_payments
  for delete to authenticated
  using (is_workspace_owner(workspace_id));
