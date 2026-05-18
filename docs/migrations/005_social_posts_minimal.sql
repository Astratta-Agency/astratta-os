-- 005_social_posts_minimal.sql
-- Minimal social_posts + content_approval_history tables for the content-approval flow.
-- The full Calendario module will extend social_posts with per-channel variants, asset library, etc.

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type public.post_type as enum ('feed_post','carousel','reel','story','video','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_status as enum (
    'draft',
    'pending_internal_review',
    'pending_approval',
    'approved',
    'rejected',
    'scheduled',
    'published',
    'archived'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- social_posts
-- ============================================================
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  title text not null,
  type public.post_type not null default 'feed_post',
  preview_url text,
  caption text,
  scheduled_for timestamptz,
  status public.post_status not null default 'draft',

  last_approval_sent_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_social_posts_client_status
  on public.social_posts (client_id, status);
create index if not exists idx_social_posts_workspace_scheduled
  on public.social_posts (workspace_id, scheduled_for);

-- updated_at trigger (reuses set_updated_at() from 001_astratta_core_schema if present)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_social_posts_updated_at on public.social_posts;
    create trigger trg_social_posts_updated_at
      before update on public.social_posts
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================
-- content_approval_history (audit log, immutable)
-- ============================================================
create table if not exists public.content_approval_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  action text not null check (action in ('sent_for_approval','approved','rejected','resent','auto_expired')),
  actor_user_id uuid references auth.users(id) on delete set null,
  recipient_emails text[],
  comment text,
  ses_message_ids jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_history_post
  on public.content_approval_history (post_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.social_posts              enable row level security;
alter table public.social_posts              force row level security;
alter table public.content_approval_history  enable row level security;
alter table public.content_approval_history  force row level security;

-- social_posts: workspace members → full CRUD
drop policy if exists "social_posts_workspace_all" on public.social_posts;
create policy "social_posts_workspace_all" on public.social_posts
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- social_posts: client_users → SELECT only when externally visible
drop policy if exists "social_posts_client_users_select" on public.social_posts;
create policy "social_posts_client_users_select" on public.social_posts
  for select to authenticated
  using (
    status in ('pending_approval','approved','rejected','published')
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = social_posts.client_id
        and cu.user_id = auth.uid()
        and cu.status = 'active'
    )
  );

-- social_posts: client_admin → UPDATE limited to approval state transitions
-- (we cannot easily diff OLD/NEW in a USING clause; enforce via trigger below
-- and let RLS allow UPDATE only for client_admin on pending_approval rows)
drop policy if exists "social_posts_client_admin_update_approval" on public.social_posts;
create policy "social_posts_client_admin_update_approval" on public.social_posts
  for update to authenticated
  using (
    status = 'pending_approval'
    and public.is_client_admin(client_id)
  )
  with check (
    status in ('approved','rejected','pending_approval')
    and public.is_client_admin(client_id)
  );

-- Trigger that hard-locks client_admin updates to status + approval fields only.
create or replace function public.enforce_client_admin_approval_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only enforce when the actor is NOT a workspace member (i.e. a client portal user).
  if public.is_workspace_member(NEW.workspace_id) then
    return NEW;
  end if;

  if not public.is_client_admin(NEW.client_id) then
    raise exception 'forbidden: only client_admin or workspace member may update social_posts';
  end if;

  -- client_admin may only flip status between pending_approval ↔ approved/rejected
  if NEW.status not in ('approved','rejected','pending_approval') then
    raise exception 'client_admin may only set status to approved, rejected, or pending_approval';
  end if;

  -- Block changes to content fields
  if NEW.title is distinct from OLD.title
     or NEW.type is distinct from OLD.type
     or NEW.preview_url is distinct from OLD.preview_url
     or NEW.caption is distinct from OLD.caption
     or NEW.scheduled_for is distinct from OLD.scheduled_for
     or NEW.workspace_id is distinct from OLD.workspace_id
     or NEW.client_id is distinct from OLD.client_id
     or NEW.project_id is distinct from OLD.project_id then
    raise exception 'client_admin cannot modify content fields';
  end if;

  -- Stamp approval audit fields
  if NEW.status = 'approved' and OLD.status <> 'approved' then
    NEW.approved_at := now();
    NEW.approved_by_user_id := auth.uid();
  end if;
  if NEW.status = 'rejected' and OLD.status <> 'rejected' then
    NEW.rejected_at := now();
  end if;

  return NEW;
end $$;

drop trigger if exists trg_enforce_client_admin_approval_update on public.social_posts;
create trigger trg_enforce_client_admin_approval_update
  before update on public.social_posts
  for each row execute function public.enforce_client_admin_approval_update();

-- content_approval_history: workspace members → SELECT + INSERT
drop policy if exists "approval_history_workspace_select" on public.content_approval_history;
create policy "approval_history_workspace_select" on public.content_approval_history
  for select to authenticated
  using (
    exists (
      select 1 from public.social_posts sp
      where sp.id = content_approval_history.post_id
        and public.is_workspace_member(sp.workspace_id)
    )
  );

drop policy if exists "approval_history_workspace_insert" on public.content_approval_history;
create policy "approval_history_workspace_insert" on public.content_approval_history
  for insert to authenticated
  with check (
    exists (
      select 1 from public.social_posts sp
      where sp.id = content_approval_history.post_id
        and public.is_workspace_member(sp.workspace_id)
    )
  );

-- content_approval_history: client_users → SELECT
drop policy if exists "approval_history_client_users_select" on public.content_approval_history;
create policy "approval_history_client_users_select" on public.content_approval_history
  for select to authenticated
  using (
    exists (
      select 1 from public.client_users cu
      where cu.client_id = content_approval_history.client_id
        and cu.user_id = auth.uid()
        and cu.status = 'active'
    )
  );

-- content_approval_history: client_admin → INSERT (only approved/rejected)
drop policy if exists "approval_history_client_admin_insert" on public.content_approval_history;
create policy "approval_history_client_admin_insert" on public.content_approval_history
  for insert to authenticated
  with check (
    public.is_client_admin(client_id)
    and action in ('approved','rejected')
    and actor_user_id = auth.uid()
  );

-- No update / no delete policies → audit log is immutable.

-- ============================================================
-- Notify Edge Function on transition into pending_approval
-- ============================================================
-- Requires pg_net + a vault secret `internal_trigger_secret` set out-of-band.
create extension if not exists pg_net;

create or replace function public.notify_content_approval_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_ref text := current_setting('app.settings.project_ref', true);
  v_fn_url      text;
  v_secret      text;
begin
  -- Fall back to env-derived ref if app.settings.project_ref isn't set.
  if v_project_ref is null or v_project_ref = '' then
    v_project_ref := (select decoded_secret from vault.decrypted_secrets where name = 'project_ref' limit 1);
  end if;
  if v_project_ref is null or v_project_ref = '' then
    raise notice 'notify_content_approval_request: missing project_ref; skipping HTTP call';
    return NEW;
  end if;

  v_secret := (select decoded_secret from vault.decrypted_secrets where name = 'internal_trigger_secret' limit 1);
  if v_secret is null then
    raise notice 'notify_content_approval_request: missing internal_trigger_secret in vault; skipping';
    return NEW;
  end if;

  v_fn_url := format('https://%s.supabase.co/functions/v1/send-content-approval-request', v_project_ref);

  perform net.http_post(
    url     := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body    := jsonb_build_object('post_id', NEW.id, 'source', 'trigger')
  );

  return NEW;
end $$;

drop trigger if exists trg_notify_content_approval_insert on public.social_posts;
create trigger trg_notify_content_approval_insert
  after insert on public.social_posts
  for each row
  when (NEW.status = 'pending_approval')
  execute function public.notify_content_approval_request();

drop trigger if exists trg_notify_content_approval_update on public.social_posts;
create trigger trg_notify_content_approval_update
  after update of status on public.social_posts
  for each row
  when (NEW.status = 'pending_approval' and OLD.status is distinct from 'pending_approval')
  execute function public.notify_content_approval_request();
