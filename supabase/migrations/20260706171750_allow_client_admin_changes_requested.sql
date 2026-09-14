create or replace function public.enforce_client_admin_approval_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Trusted backend (edge functions, service-role calls) is never subject to
  -- this actor check -- authorization already happened at the edge-function
  -- layer before it touches the row.
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  -- Only enforce when the actor is NOT a workspace member (i.e. a client portal user).
  if public.is_workspace_member(NEW.workspace_id) then
    return NEW;
  end if;

  if not public.is_client_admin(NEW.client_id) then
    raise exception 'forbidden: only client_admin or workspace member may update social_posts';
  end if;

  -- client_admin may only flip status between pending_approval and approved/rejected/changes_requested
  if NEW.status not in ('approved','rejected','changes_requested','pending_approval') then
    raise exception 'client_admin may only set status to approved, rejected, changes_requested, or pending_approval';
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
end $function$;
