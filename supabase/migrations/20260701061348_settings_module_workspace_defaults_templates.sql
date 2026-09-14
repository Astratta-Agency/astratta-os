-- Workspace-level default content pillars (16.1) — seed template for new clients,
-- separate from public.content_pillars (per-client) to avoid touching that table's
-- existing RLS/behavior.
create table if not exists public.workspace_default_pillars (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#5140f2',
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_default_pillars_workspace
  on public.workspace_default_pillars (workspace_id, sort_order);

alter table public.workspace_default_pillars enable row level security;

drop policy if exists wdp_select on public.workspace_default_pillars;
create policy wdp_select on public.workspace_default_pillars
  for select to authenticated
  using (is_workspace_member(workspace_id));

drop policy if exists wdp_insert on public.workspace_default_pillars;
create policy wdp_insert on public.workspace_default_pillars
  for insert to authenticated
  with check (is_workspace_owner(workspace_id));

drop policy if exists wdp_update on public.workspace_default_pillars;
create policy wdp_update on public.workspace_default_pillars
  for update to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

drop policy if exists wdp_delete on public.workspace_default_pillars;
create policy wdp_delete on public.workspace_default_pillars
  for delete to authenticated
  using (is_workspace_owner(workspace_id));

-- Global templates (contracts/proposals/reports) (16.1)
create table if not exists public.workspace_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null default 'otro' check (category in ('contrato','propuesta','reporte','otro')),
  body text,
  file_url text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_templates_workspace
  on public.workspace_templates (workspace_id, category);

alter table public.workspace_templates enable row level security;

drop policy if exists wt_select on public.workspace_templates;
create policy wt_select on public.workspace_templates
  for select to authenticated
  using (is_workspace_member(workspace_id));

drop policy if exists wt_insert on public.workspace_templates;
create policy wt_insert on public.workspace_templates
  for insert to authenticated
  with check (is_workspace_owner(workspace_id));

drop policy if exists wt_update on public.workspace_templates;
create policy wt_update on public.workspace_templates
  for update to authenticated
  using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

drop policy if exists wt_delete on public.workspace_templates;
create policy wt_delete on public.workspace_templates
  for delete to authenticated
  using (is_workspace_owner(workspace_id));

-- Per-user, per-event notification preferences (16.3) — in-app only for now.
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in (
    'post_approved','post_rejected','post_changes_requested',
    'invite_accepted','payment_received','contract_expiring'
  )),
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_type)
);

create index if not exists idx_notification_preferences_user
  on public.notification_preferences (user_id);

alter table public.notification_preferences enable row level security;

drop policy if exists np_select on public.notification_preferences;
create policy np_select on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists np_insert on public.notification_preferences;
create policy np_insert on public.notification_preferences
  for insert to authenticated
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));

drop policy if exists np_update on public.notification_preferences;
create policy np_update on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists np_delete on public.notification_preferences;
create policy np_delete on public.notification_preferences
  for delete to authenticated
  using (user_id = auth.uid());
