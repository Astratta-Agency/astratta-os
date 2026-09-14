revoke execute on function public.update_member_full_name(uuid, uuid, text) from anon;
revoke execute on function public.update_member_full_name(uuid, uuid, text) from public;
grant execute on function public.update_member_full_name(uuid, uuid, text) to authenticated;
