-- ============================================================
-- Google Calendar integration: connections + sync map
-- Per-user OAuth connection, dedicated secondary calendar,
-- bidirectional date sync for tasks (assigned_to) and social_posts (workspace-wide).
-- Tokens are NEVER exposed to authenticated/anon roles: RLS is enabled with
-- zero policies, so only service_role (edge functions) and SECURITY DEFINER
-- functions owned by postgres can touch these tables.
-- ============================================================

create table public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  google_email text,
  google_calendar_id text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  sync_next_token text,
  last_synced_at timestamptz,
  is_active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

alter table public.google_calendar_connections enable row level security;
-- Intentionally no policies: authenticated/anon get zero access to raw tokens.

create index idx_gcal_connections_workspace on public.google_calendar_connections(workspace_id);
create index idx_gcal_connections_active on public.google_calendar_connections(is_active) where is_active = true;

create table public.google_calendar_sync_map (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  entity_type text not null check (entity_type in ('task','social_post')),
  entity_id uuid not null,
  google_event_id text not null,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, entity_type, entity_id),
  unique (connection_id, google_event_id)
);

alter table public.google_calendar_sync_map enable row level security;
-- Intentionally no policies: only service_role (edge functions) manages sync state.

create index idx_gcal_sync_map_entity on public.google_calendar_sync_map(entity_type, entity_id);
create index idx_gcal_sync_map_connection on public.google_calendar_sync_map(connection_id);

-- Safe status check for the frontend: returns connection metadata, never tokens.
create or replace function public.get_my_google_calendar_status(p_workspace_id uuid)
returns table (
  connected boolean,
  google_email text,
  last_synced_at timestamptz,
  is_active boolean,
  last_error text
)
language sql
security definer
set search_path = public
as $$
  select
    true as connected,
    c.google_email,
    c.last_synced_at,
    c.is_active,
    c.last_error
  from public.google_calendar_connections c
  where c.user_id = auth.uid()
    and c.workspace_id = p_workspace_id
  limit 1;
$$;

revoke execute on function public.get_my_google_calendar_status(uuid) from public, anon;
grant execute on function public.get_my_google_calendar_status(uuid) to authenticated;
