-- Corrective pass: Supabase grants EXECUTE to `anon`/`authenticated` directly
-- (via default privileges), not only through PUBLIC. Revoking from PUBLIC
-- alone does not remove those direct grants — revoke explicitly per role.

-- Trigger-only / internal helpers: no direct RPC caller needed at all
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.set_post_variants_updated_at() from anon, authenticated, public;
revoke execute on function public.generate_slug(text) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_workspace() from anon, authenticated, public;
revoke execute on function public.enforce_client_admin_approval_update() from anon, authenticated, public;
revoke execute on function public.guard_post_approval_double_submit() from anon, authenticated, public;
revoke execute on function public.notify_content_approval_request() from anon, authenticated, public;
revoke execute on function public.notify_post_status_change() from anon, authenticated, public;
revoke execute on function public.tl_on_client_insert() from anon, authenticated, public;
revoke execute on function public.tl_on_client_update() from anon, authenticated, public;
revoke execute on function public.tl_on_contact_insert() from anon, authenticated, public;
revoke execute on function public.tl_on_note_update() from anon, authenticated, public;
revoke execute on function public.tl_on_project_insert() from anon, authenticated, public;
revoke execute on function public.tl_on_project_update() from anon, authenticated, public;

-- RLS-helper / app-callable functions: needed by `authenticated` only
revoke execute on function public.can_write_workspace(uuid) from anon, authenticated, public;
grant execute on function public.can_write_workspace(uuid) to authenticated;

revoke execute on function public.client_in_member_workspace(uuid) from anon, authenticated, public;
grant execute on function public.client_in_member_workspace(uuid) to authenticated;

revoke execute on function public.create_workspace(text, text) from anon, authenticated, public;
grant execute on function public.create_workspace(text, text) to authenticated;

revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from anon, authenticated, public;
grant execute on function public.has_workspace_role(uuid, public.workspace_role) to authenticated;

revoke execute on function public.is_client_admin(uuid) from anon, authenticated, public;
grant execute on function public.is_client_admin(uuid) to authenticated;

revoke execute on function public.is_client_user(uuid) from anon, authenticated, public;
grant execute on function public.is_client_user(uuid) to authenticated;

revoke execute on function public.is_workspace_member(uuid) from anon, authenticated, public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke execute on function public.is_workspace_owner(uuid) from anon, authenticated, public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

revoke execute on function public.profile_visible_to_client_user(uuid) from anon, authenticated, public;
grant execute on function public.profile_visible_to_client_user(uuid) to authenticated;

revoke execute on function public.shares_workspace_with(uuid) from anon, authenticated, public;
grant execute on function public.shares_workspace_with(uuid) to authenticated;
