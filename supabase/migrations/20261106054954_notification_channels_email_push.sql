-- Notification preferences: all event types + email and desktop (push) channels.
--
-- Before this migration:
--   * notification_preferences.event_type only accepted 6 of the 14 types that
--     public.notifications can hold, so leads, proposals, tasks, contracts and
--     invoices could not be configured at all.
--   * Only the in-app channel existed. Email and Push were "Próximamente".
--
-- After:
--   * Every notification type can be configured.
--   * in_app_enabled (default on), email_enabled (default off) and
--     push_enabled (default off; desktop notifications shown by the browser
--     while the app is open) per user and event.
--   * One BEFORE INSERT trigger on public.notifications applies the
--     preferences for every producer (SQL triggers, cron jobs and edge
--     functions such as stripe-webhook). It queues an email in
--     notification_email_outbox when email is on, and drops the in-app row
--     when in-app is off. The producers no longer filter by preference
--     themselves, otherwise turning in-app off would also silence email.
--   * pg_cron calls the send-notification-emails edge function every minute
--     while there are pending emails. It authenticates with the existing
--     internal cron secret (vault 'google_calendar_sync_secret' =
--     edge secret SYNC_CRON_SECRET).

-- 1. Preferences: all event types + new channels ------------------------------

alter table public.notification_preferences
  drop constraint if exists notification_preferences_event_type_check;

alter table public.notification_preferences
  add constraint notification_preferences_event_type_check
  check (event_type = any (array[
    'post_approved','post_rejected','post_changes_requested','invite_accepted',
    'payment_received','contract_expiring','new_lead','proposal_signed',
    'task_assigned','contract_signed',
    'invoice_sent','invoice_paid','invoice_overdue','invoice_payment_failed'
  ]));

alter table public.notification_preferences
  add column if not exists email_enabled boolean not null default false,
  add column if not exists push_enabled boolean not null default false;

-- Existing table (pre 2026-10-30) already has its grants; restate the ones
-- the app needs so a fresh environment matches.
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences to service_role;

-- 2. Email outbox -------------------------------------------------------------

create table if not exists public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

create index if not exists idx_notification_email_outbox_pending
  on public.notification_email_outbox (created_at)
  where status in ('pending','sending');

create index if not exists idx_notification_email_outbox_recipient
  on public.notification_email_outbox (recipient_user_id);

-- Only the edge function (service_role) reads or writes the outbox. RLS on
-- with no policies for authenticated/anon = no access from the app.
alter table public.notification_email_outbox enable row level security;

revoke all on public.notification_email_outbox from anon, authenticated;
grant select, insert, update, delete on public.notification_email_outbox to service_role;

-- Atomically claim a batch of pending emails (safe if two runs overlap).
-- Rows stuck in 'sending' for more than 10 minutes are retried.
create or replace function public.claim_notification_emails(p_limit integer default 50)
returns setof public.notification_email_outbox
language sql
security definer
set search_path = public
as $$
  update public.notification_email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select id from public.notification_email_outbox
      where (status = 'pending'
             or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
        and attempts < 5
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning o.*;
$$;

revoke execute on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;

-- 3. Apply preferences on every notification insert ---------------------------

create or replace function public.apply_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in_app boolean;
  v_email boolean;
begin
  select np.in_app_enabled, np.email_enabled
    into v_in_app, v_email
    from public.notification_preferences np
   where np.user_id = NEW.recipient_user_id
     and np.event_type = NEW.type
   limit 1;

  if coalesce(v_email, false) then
    insert into public.notification_email_outbox
      (workspace_id, recipient_user_id, type, title, body, link)
    values
      (NEW.workspace_id, NEW.recipient_user_id, NEW.type, NEW.title, NEW.body, NEW.link);
  end if;

  if not coalesce(v_in_app, true) then
    return null; -- skip the in-app row
  end if;

  return NEW;
end;
$$;

revoke execute on function public.apply_notification_preferences() from public, anon, authenticated;

drop trigger if exists trg_apply_notification_preferences on public.notifications;
create trigger trg_apply_notification_preferences
  before insert on public.notifications
  for each row execute function public.apply_notification_preferences();

-- 4. Producers stop filtering by in-app preference (the trigger does it) ------

create or replace function public.notify_workspace_members(
  p_workspace_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_link text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link, metadata)
  select p_workspace_id, wm.user_id, p_event_type, p_title, p_body, p_link, p_metadata
    from public.workspace_members wm
   where wm.workspace_id = p_workspace_id
     and wm.status = 'active';
end;
$$;

revoke execute on function public.notify_workspace_members(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function public.notify_post_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_client_name text;
  v_post_title text;
  v_type text;
begin
  if OLD.status = NEW.status then
    return NEW;
  end if;

  if NEW.status not in ('approved','rejected','changes_requested') then
    return NEW;
  end if;

  select c.workspace_id, c.name into v_workspace_id, v_client_name
  from public.clients c where c.id = NEW.client_id;

  if v_workspace_id is null then
    return NEW;
  end if;

  v_post_title := coalesce(nullif(substr(coalesce(NEW.caption, NEW.title, ''), 1, 80), ''), 'Post sin título');
  v_type := 'post_' || NEW.status;

  insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link, metadata)
  select
    v_workspace_id,
    wm.user_id,
    v_type,
    case NEW.status
      when 'approved' then coalesce(v_client_name, 'El cliente') || ' aprobó un post'
      when 'rejected' then coalesce(v_client_name, 'El cliente') || ' rechazó un post'
      when 'changes_requested' then coalesce(v_client_name, 'El cliente') || ' solicitó cambios'
      else 'Actualización de post'
    end,
    v_post_title,
    '/app/calendario?post=' || NEW.id::text || '&client_id=' || NEW.client_id::text,
    jsonb_build_object(
      'post_id', NEW.id,
      'client_id', NEW.client_id,
      'new_status', NEW.status,
      'old_status', OLD.status,
      'rejection_reason', NEW.rejection_reason
    )
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id
    and wm.status = 'active'
    and wm.role in ('owner','team_member');

  return NEW;
end $$;

revoke execute on function public.notify_post_status_change() from public, anon, authenticated;

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.assigned_to is not null and (TG_OP = 'INSERT' or NEW.assigned_to is distinct from OLD.assigned_to) then
    insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link)
    values (
      NEW.workspace_id, NEW.assigned_to, 'task_assigned',
      'Nueva tarea asignada: ' || NEW.title,
      coalesce(NEW.description, ''),
      '/app/tareas?task=' || NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

revoke execute on function public.notify_task_assigned() from public, anon, authenticated;

-- 5. Cron: deliver queued emails every minute (only calls out when needed) ----

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-notification-emails') then
    perform cron.unschedule('send-notification-emails');
  end if;
end $$;

select cron.schedule(
  'send-notification-emails',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://vdnblnrwkkychxzbixam.supabase.co/functions/v1/send-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Sync-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.notification_email_outbox
     where status in ('pending','sending') and attempts < 5
  );
  $cron$
);
