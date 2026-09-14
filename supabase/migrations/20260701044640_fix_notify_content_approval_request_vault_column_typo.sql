-- Second bug uncovered by the same live "Enviar a cliente" test, after fixing
-- the service_role trigger guard: the AFTER UPDATE/INSERT trigger
-- notify_content_approval_request() queries `vault.decrypted_secrets` for a
-- column called "decoded_secret" -- that column doesn't exist, the real
-- column is "decrypted_secret". Any UPDATE of social_posts.status to
-- 'pending_approval' fired this trigger, which errored with
-- "column \"decoded_secret\" does not exist", rolling back the whole UPDATE
-- statement -- which is exactly the failure the send-content-approval-request
-- edge function was seeing as "status_transition_failed" (500).
--
-- Fixing the column name. Note: separately, there is currently no
-- 'project_ref' or 'internal_trigger_secret' secret configured in
-- vault.decrypted_secrets, so even after this fix the function's own
-- fallback logic will log a notice and skip the net.http_post call (it does
-- NOT raise -- this is intentional graceful-degradation code already in the
-- function). That's fine functionally: this trigger is a belt-and-suspenders
-- path that re-invokes the same edge function via HTTP; the actual email is
-- already sent synchronously by the edge function itself when called from
-- the UI. Configuring those two vault secrets is a separate, non-blocking
-- follow-up if the DB-trigger-initiated path is ever needed on its own.
CREATE OR REPLACE FUNCTION public.notify_content_approval_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_project_ref text := current_setting('app.settings.project_ref', true);
  v_fn_url      text;
  v_secret      text;
begin
  -- Fall back to env-derived ref if app.settings.project_ref isn't set.
  if v_project_ref is null or v_project_ref = '' then
    v_project_ref := (select decrypted_secret from vault.decrypted_secrets where name = 'project_ref' limit 1);
  end if;
  if v_project_ref is null or v_project_ref = '' then
    raise notice 'notify_content_approval_request: missing project_ref; skipping HTTP call';
    return NEW;
  end if;

  v_secret := (select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret' limit 1);
  if v_secret is null then
    raise notice 'notify_content_approval_request: missing internal_trigger_secret in vault; skipping';
    return NEW;
  end if;

  v_fn_url := format('https://%s.supabase.co/functions/v1/send-content-approval-request', v_project_ref);

  perform net.http_post(
    url     := v_fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body    := jsonb_build_object('post_id', NEW.id, 'source', 'trigger')
  );

  return NEW;
end $function$;
