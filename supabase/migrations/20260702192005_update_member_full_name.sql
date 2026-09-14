-- Migration 015: allow workspace owner to update a member's profile full_name
-- Uses SECURITY DEFINER to bypass the profiles_update_self RLS policy.

create or replace function public.update_member_full_name(
  _workspace_id uuid,
  _user_id uuid,
  _full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_owner(_workspace_id) then
    raise exception 'forbidden: only workspace owners can update member names';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
      and status = 'active'
  ) then
    raise exception 'user is not an active member of this workspace';
  end if;

  update public.profiles
     set full_name = nullif(btrim(_full_name), '')
   where id = _user_id;
end;
$$;

revoke all on function public.update_member_full_name(uuid, uuid, text) from public;
grant execute on function public.update_member_full_name(uuid, uuid, text) to authenticated;
