-- =========================================================================
-- Astratta OS — Security & performance hardening (Supabase advisors)
-- 2026-06-30
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Indexes on previously unindexed foreign keys (PERFORMANCE)
-- -------------------------------------------------------------------------
create index if not exists idx_client_notes_updated_by on public.client_notes(updated_by);
create index if not exists idx_client_timeline_events_actor_id on public.client_timeline_events(actor_id);
create index if not exists idx_client_timeline_events_workspace_id on public.client_timeline_events(workspace_id);
create index if not exists idx_client_users_invited_by on public.client_users(invited_by);
create index if not exists idx_content_approval_history_actor_user_id on public.content_approval_history(actor_user_id);
create index if not exists idx_content_approval_history_client_id on public.content_approval_history(client_id);
create index if not exists idx_media_assets_before_after_pair_id on public.media_assets(before_after_pair_id);
create index if not exists idx_media_assets_uploaded_by on public.media_assets(uploaded_by);
create index if not exists idx_media_assets_workspace_id on public.media_assets(workspace_id);
create index if not exists idx_notifications_workspace_id on public.notifications(workspace_id);
create index if not exists idx_post_variants_updated_by on public.post_variants(updated_by);
create index if not exists idx_social_posts_approved_by_user_id on public.social_posts(approved_by_user_id);
create index if not exists idx_social_posts_created_by on public.social_posts(created_by);
create index if not exists idx_social_posts_project_id on public.social_posts(project_id);
create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_workspaces_created_by on public.workspaces(created_by);

-- -------------------------------------------------------------------------
-- 2. Fix mutable search_path on 3 functions (SECURITY)
-- -------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_slug(text) set search_path = public, pg_temp;
alter function public.set_post_variants_updated_at() set search_path = public, pg_temp;

-- -------------------------------------------------------------------------
-- 3. Lock down function EXECUTE grants (SECURITY)
--    No RLS policy in this schema targets `anon` (verified against pg_policies),
--    so anon never needed EXECUTE on any of these. Trigger-only functions
--    need no direct EXECUTE grant at all — Postgres invokes triggers without
--    checking the firing role's EXECUTE privilege on the trigger function.
-- -------------------------------------------------------------------------

-- Trigger-only / internal helpers: no direct RPC caller needed
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_post_variants_updated_at() from public;
revoke execute on function public.generate_slug(text) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_workspace() from public;
revoke execute on function public.enforce_client_admin_approval_update() from public;
revoke execute on function public.guard_post_approval_double_submit() from public;
revoke execute on function public.notify_content_approval_request() from public;
revoke execute on function public.notify_post_status_change() from public;
revoke execute on function public.tl_on_client_insert() from public;
revoke execute on function public.tl_on_client_update() from public;
revoke execute on function public.tl_on_contact_insert() from public;
revoke execute on function public.tl_on_note_update() from public;
revoke execute on function public.tl_on_project_insert() from public;
revoke execute on function public.tl_on_project_update() from public;

-- RLS-helper / app-callable functions: needed by `authenticated` only
revoke execute on function public.can_write_workspace(uuid) from public;
grant execute on function public.can_write_workspace(uuid) to authenticated;

revoke execute on function public.client_in_member_workspace(uuid) from public;
grant execute on function public.client_in_member_workspace(uuid) to authenticated;

revoke execute on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;

revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from public;
grant execute on function public.has_workspace_role(uuid, public.workspace_role) to authenticated;

revoke execute on function public.is_client_admin(uuid) from public;
grant execute on function public.is_client_admin(uuid) to authenticated;

revoke execute on function public.is_client_user(uuid) from public;
grant execute on function public.is_client_user(uuid) to authenticated;

revoke execute on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke execute on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

revoke execute on function public.profile_visible_to_client_user(uuid) from public;
grant execute on function public.profile_visible_to_client_user(uuid) to authenticated;

revoke execute on function public.shares_workspace_with(uuid) from public;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 4. Storage: remove public-read policies that allow listing bucket contents
--    (SECURITY). Both buckets are flagged `public = true` at the bucket
--    level, so individual object URLs (storage.from(bucket).getPublicUrl())
--    keep working without any storage.objects SELECT policy — confirmed the
--    app never calls storage.list(), it lists media via the `media_assets`
--    table (which has its own RLS), and only renders <img src=public_url>.
-- -------------------------------------------------------------------------
drop policy if exists "client-media public read t8dh0i_0" on storage.objects;
drop policy if exists "workspace-logos public read" on storage.objects;

-- -------------------------------------------------------------------------
-- 5. RLS performance: wrap auth.uid() as (select auth.uid()) so Postgres
--    evaluates it once per query instead of once per row (PERFORMANCE).
--    Semantics are unchanged — only the evaluation plan changes.
-- -------------------------------------------------------------------------

alter policy profiles_select_self_or_shared on public.profiles
  using ((id = (select auth.uid())) or shares_workspace_with(id) or profile_visible_to_client_user(id));

alter policy profiles_insert_self on public.profiles
  with check (id = (select auth.uid()));

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy workspaces_insert_self on public.workspaces
  with check (((select auth.uid()) is not null) and (created_by = (select auth.uid())));

alter policy members_select_member_or_self on public.workspace_members
  using ((user_id = (select auth.uid())) or is_workspace_member(workspace_id));

alter policy client_users_select_member_or_self on public.client_users
  using ((user_id = (select auth.uid())) or client_in_member_workspace(client_id));

alter policy tasks_update_assignee_or_writer on public.tasks
  using (is_workspace_member(workspace_id) and ((assigned_to = (select auth.uid())) or can_write_workspace(workspace_id)))
  with check (is_workspace_member(workspace_id) and ((assigned_to = (select auth.uid())) or can_write_workspace(workspace_id)));

alter policy social_posts_client_users_select on public.social_posts
  using (
    (status = any (array['pending_approval'::post_status,'approved'::post_status,'rejected'::post_status,'published'::post_status]))
    and exists (
      select 1 from client_users cu
      where cu.client_id = social_posts.client_id
        and cu.user_id = (select auth.uid())
        and cu.status = 'active'::text
    )
  );

alter policy approval_history_client_users_select on public.content_approval_history
  using (
    exists (
      select 1 from client_users cu
      where cu.client_id = content_approval_history.client_id
        and cu.user_id = (select auth.uid())
        and cu.status = 'active'::text
    )
  );

alter policy approval_history_client_admin_insert on public.content_approval_history
  with check (
    is_client_admin(client_id)
    and (action = any (array['approved'::text,'rejected'::text]))
    and (actor_user_id = (select auth.uid()))
  );

alter policy notifications_select on public.notifications
  using (recipient_user_id = (select auth.uid()));

alter policy notifications_update on public.notifications
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

-- -------------------------------------------------------------------------
-- 6. Remove duplicate permissive policy on workspace_members
--    (workspace_members_select duplicated members_select_member_or_self
--    verbatim — fixes one of the multiple_permissive_policies findings).
-- -------------------------------------------------------------------------
drop policy if exists workspace_members_select on public.workspace_members;
