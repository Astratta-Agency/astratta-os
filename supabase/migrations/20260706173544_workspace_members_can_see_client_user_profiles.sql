create or replace function public.profile_visible_to_workspace_member(_profile_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.client_users cu
    join public.clients c on c.id = cu.client_id
    join public.workspace_members wm on wm.workspace_id = c.workspace_id
    where cu.user_id = _profile_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

alter policy profiles_select_self_or_shared on public.profiles
  using (
    (id = (select auth.uid()))
    or shares_workspace_with(id)
    or profile_visible_to_client_user(id)
    or profile_visible_to_workspace_member(id)
  );
