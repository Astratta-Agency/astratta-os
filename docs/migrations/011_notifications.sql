-- 011_notifications.sql
-- In-app notifications table + trigger that fires on client-driven
-- social_posts status changes (approved / rejected / changes_requested).
-- Also adds a BEFORE-UPDATE guard to prevent double-submit races from the portal.
-- Apply manually in Supabase SQL Editor.

-- ============================================================
-- Table
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'post_approved','post_rejected','post_changes_requested',
    'invite_accepted','payment_received','contract_expiring'
  )),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  read_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_user_id, created_at desc)
  where read = false;

create index if not exists idx_notifications_recipient_all
  on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- No insert policy: notifications are written by the trigger (security definer).

-- ============================================================
-- AFTER UPDATE: fan-out notifications to agency members
-- ============================================================
create or replace function public.notify_post_status_change()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_workspace_id uuid;
  v_client_name text;
  v_post_title text;
begin
  if OLD.status = NEW.status then
    return NEW;
  end if;

  if NEW.status not in ('approved','rejected','changes_requested') then
    return NEW;
  end if;

  select c.workspace_id, c.name into v_workspace_id, v_client_name
  from public.clients c where c.id = NEW.client_id;

  if v_workspace_id is null then
    return NEW;
  end if;

  v_post_title := coalesce(nullif(substr(coalesce(NEW.caption, NEW.title, ''), 1, 80), ''), 'Post sin título');

  insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link, metadata)
  select
    v_workspace_id,
    wm.user_id,
    'post_' || NEW.status,
    case NEW.status
      when 'approved' then coalesce(v_client_name, 'El cliente') || ' aprobó un post'
      when 'rejected' then coalesce(v_client_name, 'El cliente') || ' rechazó un post'
      when 'changes_requested' then coalesce(v_client_name, 'El cliente') || ' solicitó cambios'
      else 'Actualización de post'
    end,
    v_post_title,
    '/app/calendario?post=' || NEW.id::text,
    jsonb_build_object(
      'post_id', NEW.id,
      'client_id', NEW.client_id,
      'new_status', NEW.status,
      'old_status', OLD.status,
      'rejection_reason', NEW.rejection_reason
    )
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id
    and wm.status = 'active'
    and wm.role in ('owner','team_member');

  return NEW;
end $$;

drop trigger if exists trg_notify_post_status_change on public.social_posts;
create trigger trg_notify_post_status_change
  after update of status on public.social_posts
  for each row execute function public.notify_post_status_change();

-- ============================================================
-- BEFORE UPDATE: double-submit guard for approval responses
-- Prevents two simultaneous portal users from racing on the same post.
-- ============================================================
create or replace function public.guard_post_approval_double_submit()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_recent_count int;
begin
  if OLD.status = 'pending_approval'
     and NEW.status in ('approved','rejected','changes_requested') then
    select count(*) into v_recent_count
    from public.content_approval_history h
    where h.post_id = OLD.id
      and h.action in ('approved','rejected','changes_requested')
      and h.created_at > now() - interval '2 seconds';

    if v_recent_count > 0 then
      raise exception 'Ya hubo una respuesta a este post en los últimos 2 segundos. Refresca la página.'
        using errcode = '40001';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_guard_post_approval_double_submit on public.social_posts;
create trigger trg_guard_post_approval_double_submit
  before update of status on public.social_posts
  for each row execute function public.guard_post_approval_double_submit();
