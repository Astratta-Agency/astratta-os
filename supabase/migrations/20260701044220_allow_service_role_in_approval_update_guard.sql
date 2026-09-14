-- Bug: the edge function `send-content-approval-request` updates social_posts
-- (status -> pending_approval) using the SERVICE ROLE key, which has no JWT
-- "sub" claim. The BEFORE UPDATE trigger `enforce_client_admin_approval_update`
-- checks is_workspace_member()/is_client_admin(), both of which key off
-- auth.uid() -- null for a service-role session -- so it always fell through
-- to `raise exception 'forbidden: only client_admin or workspace member...'`,
-- which the edge function surfaced as a 500 ("status_transition_failed"),
-- shown to the user as "No se pudo enviar".
--
-- Fix: exempt the service_role session (our trusted backend / edge functions)
-- from this actor check up front. The edge function already gates who may
-- trigger it (workspace membership check for manual sends, x-internal-secret
-- header for DB-trigger-initiated sends), so this doesn't weaken the actual
-- authorization -- it just stops the DB trigger from redundantly (and
-- incorrectly) treating the trusted backend as an anonymous actor.
CREATE OR REPLACE FUNCTION public.enforce_client_admin_approval_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
end $function$;
