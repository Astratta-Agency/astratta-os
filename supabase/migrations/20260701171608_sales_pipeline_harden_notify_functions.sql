revoke execute on function public.notify_workspace_members(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.trg_notify_new_lead() from public, anon, authenticated;
revoke execute on function public.trg_notify_proposal_signed() from public, anon, authenticated;
