-- 010_post_status_changes_requested.sql
-- Phase 5.1 — Adds 'changes_requested' status + RLS audit so client_users can
-- act from the portal. Apply via Supabase SQL editor.

-- ============================================================
-- 1. Enum value
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'post_status' and e.enumlabel = 'changes_requested'
  ) then
    alter type public.post_status add value 'changes_requested' before 'approved';
  end if;
end $$;

-- ============================================================
-- 2. is_client_admin helper (idempotent)
-- ============================================================
create or replace function public.is_client_admin(_client_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.client_users
    where client_id = _client_id
      and user_id = auth.uid()
      and role = 'client_admin'
      and status in ('active','invited')
  );
$$;

-- ============================================================
-- 3. RLS — broaden client_users SELECT to include new + scheduled states
-- ============================================================
drop policy if exists "social_posts_client_users_select" on public.social_posts;
create policy "social_posts_client_users_select" on public.social_posts
  for select to authenticated
  using (
    status in ('pending_approval','approved','rejected','changes_requested','scheduled','published')
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = social_posts.client_id
        and cu.user_id = auth.uid()
        and cu.status in ('active','invited')
    )
  );

-- ============================================================
-- 4. RLS — allow client_admin to move pending_approval → approved/rejected/changes_requested
--    and move changes_requested back to pending_approval (after re-review).
-- ============================================================
drop policy if exists "social_posts_client_admin_update_approval" on public.social_posts;
create policy "social_posts_client_admin_update_approval" on public.social_posts
  for update to authenticated
  using (
    status in ('pending_approval','changes_requested')
    and public.is_client_admin(client_id)
  )
  with check (
    status in ('approved','rejected','changes_requested','pending_approval')
    and public.is_client_admin(client_id)
  );

-- Extend the existing trigger to accept changes_requested as a valid client-driven status
create or replace function public.enforce_client_admin_approval_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_workspace_member(NEW.workspace_id) then
    return NEW;
  end if;

  if not public.is_client_admin(NEW.client_id) then
    raise exception 'forbidden: only client_admin or workspace member may update social_posts';
  end if;

  if NEW.status not in ('approved','rejected','changes_requested','pending_approval') then
    raise exception 'client_admin may only set status to approved, rejected, changes_requested, or pending_approval';
  end if;

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

  if NEW.status = 'approved' and OLD.status <> 'approved' then
    NEW.approved_at := now();
    NEW.approved_by_user_id := auth.uid();
  end if;
  if NEW.status = 'rejected' and OLD.status <> 'rejected' then
    NEW.rejected_at := now();
  end if;

  return NEW;
end $$;

-- ============================================================
-- 5. content_approval_history: allow client_admin to insert 'changes_requested'
-- ============================================================
alter table public.content_approval_history
  drop constraint if exists content_approval_history_action_check;
alter table public.content_approval_history
  add constraint content_approval_history_action_check
  check (action in ('sent_for_approval','approved','rejected','changes_requested','resent','auto_expired'));

drop policy if exists "approval_history_client_admin_insert" on public.content_approval_history;
create policy "approval_history_client_admin_insert" on public.content_approval_history
  for insert to authenticated
  with check (
    public.is_client_admin(client_id)
    and action in ('approved','rejected','changes_requested')
    and actor_user_id = auth.uid()
  );

-- Broaden client_users SELECT on approval history to include invited members too
drop policy if exists "approval_history_client_users_select" on public.content_approval_history;
create policy "approval_history_client_users_select" on public.content_approval_history
  for select to authenticated
  using (
    exists (
      select 1 from public.client_users cu
      where cu.client_id = content_approval_history.client_id
        and cu.user_id = auth.uid()
        and cu.status in ('active','invited')
    )
  );
