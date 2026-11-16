-- Automatic client health score.
--
-- Before: clients.health_score existed (0-100, nullable) and the UI displayed
-- it, but nothing ever wrote it, so every client showed "Sin datos".
--
-- After: the database maintains it. Rule (public.compute_client_health):
--
--   Component      Weight  100 means                    Loses points when
--   -------------  ------  ---------------------------  ------------------------------
--   payments         35    no invoice past due          each past-due invoice: -15
--                                                       (1-7 days), -30 (8-30), -50 (30+)
--   delivery         30    no open task past due        % of the client's current tasks
--                                                       (open + done in the last 30 days)
--                                                       that are open and past due
--   approvals        20    content flows without        % of recent posts (60 days) with
--                          friction                     changes requested, rejected, or
--                                                       waiting on the client 5+ days
--   relationship     15    contract in force and        contract expiring / expired, and
--                          recent activity              days since the last timeline event
--
--   * The score is the weighted average of the components that have data
--     (a client with no invoices is not judged on payments).
--   * It is NULL ("Sin datos") for prospect / churned clients, and while none
--     of payments / delivery / approvals has data yet: contract + activity
--     alone say too little.
--
-- clients.health_score keeps the number (the lists read it). The per-component
-- breakdown lives in public.client_health, which only workspace members can
-- read: clients.* is also visible to portal users, the breakdown must not be.
--
-- Recalculated when an invoice, task, post or contract of the client changes,
-- when the client's status changes, and once a day by pg_cron (a due date can
-- pass without any row being written).

-- 1. Storage ------------------------------------------------------------------

create table if not exists public.client_health (
  client_id   uuid primary key references public.clients(id) on delete cascade,
  score       smallint check (score is null or (score between 0 and 100)),
  breakdown   jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

alter table public.client_health enable row level security;

drop policy if exists client_health_select_member on public.client_health;
create policy client_health_select_member on public.client_health
  for select to authenticated
  using (public.client_in_member_workspace(client_id));

-- Read-only for the app: rows are written by the security definer functions
-- below. No policy and no grant for anon.
revoke all on public.client_health from public, anon, authenticated;
grant select on public.client_health to authenticated;
grant select, insert, update, delete on public.client_health to service_role;

-- 2. Calculation --------------------------------------------------------------

create or replace function public.compute_client_health(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.client_status;

  v_inv_total          int;
  v_inv_open           int;
  v_inv_overdue        int;
  v_inv_overdue_amount numeric;
  v_inv_max_days       int;
  v_inv_penalty        int;
  v_payments           int;

  v_tasks_current int;
  v_tasks_open    int;
  v_tasks_overdue int;
  v_delivery      int;

  v_posts_recent  int;
  v_posts_changes int;
  v_posts_reject  int;
  v_posts_stalled int;
  v_approvals     int;

  v_contract_score int;
  v_contract_state text;
  v_contract_end   date;
  v_last_activity  timestamptz;
  v_days_inactive  int;
  v_activity       int;
  v_relationship   int;

  v_weight int := 0;
  v_sum    int := 0;
  v_score  int;
begin
  select c.status into v_status from public.clients c where c.id = p_client_id;
  if not found then
    return null;
  end if;

  if v_status not in ('active', 'paused') then
    return jsonb_build_object('version', 1, 'score', null, 'reason', 'status', 'components', '{}'::jsonb);
  end if;

  -- Payments: issued invoices only (drafts and voided ones don't count).
  select count(*),
         count(*) filter (where x.status in ('sent', 'partial', 'overdue')),
         count(*) filter (where x.late),
         coalesce(sum(x.total - coalesce(x.amount_paid, 0)) filter (where x.late), 0),
         coalesce(max(x.days_late) filter (where x.late), 0),
         coalesce(sum(case when x.days_late <= 7 then 15 when x.days_late <= 30 then 30 else 50 end)
                    filter (where x.late), 0)
    into v_inv_total, v_inv_open, v_inv_overdue, v_inv_overdue_amount, v_inv_max_days, v_inv_penalty
    from (
      select i.status, i.total, i.amount_paid,
             (current_date - i.due_date) as days_late,
             (i.status in ('sent', 'partial', 'overdue')
               and i.due_date is not null and i.due_date < current_date) as late
        from public.invoices i
       where i.client_id = p_client_id
         and i.status not in ('draft', 'void')
    ) x;
  if v_inv_total > 0 then
    v_payments := greatest(0, 100 - v_inv_penalty);
  end if;

  -- Delivery: leaf tasks only (a parent is represented by its subtasks, same
  -- rule as project progress). "Current" = still open, or closed in the last
  -- 30 days, so one late task among many delivered ones weighs little.
  select count(*),
         count(*) filter (where t.status <> 'done'),
         count(*) filter (where t.status <> 'done' and t.due_date is not null and t.due_date < current_date)
    into v_tasks_current, v_tasks_open, v_tasks_overdue
    from public.tasks t
   where t.client_id = p_client_id
     and not exists (select 1 from public.tasks c where c.parent_task_id = t.id)
     and (t.status <> 'done' or t.updated_at >= now() - interval '30 days');
  if v_tasks_current > 0 then
    v_delivery := round(100.0 * (v_tasks_current - v_tasks_overdue) / v_tasks_current);
  end if;

  -- Approvals: posts that reached the client recently.
  select count(*),
         count(*) filter (where p.status = 'changes_requested'),
         count(*) filter (where p.status = 'rejected'),
         count(*) filter (where p.status = 'pending_approval'
                            and coalesce(p.last_approval_sent_at, p.updated_at) < now() - interval '5 days')
    into v_posts_recent, v_posts_changes, v_posts_reject, v_posts_stalled
    from public.social_posts p
   where p.client_id = p_client_id
     and (
       p.status in ('pending_approval', 'changes_requested')
       or (p.status = 'rejected'
           and coalesce(p.rejected_at, p.updated_at) >= now() - interval '60 days')
       or (p.status in ('approved', 'scheduled', 'published')
           and coalesce(p.approved_at, p.scheduled_for, p.updated_at) >= now() - interval '60 days')
     );
  if v_posts_recent > 0 then
    v_approvals := round(
      100.0 * (v_posts_recent - v_posts_changes - v_posts_reject - v_posts_stalled) / v_posts_recent
    );
  end if;

  -- Relationship, part 1: the client's best contract.
  select x.score, x.state, x.end_date
    into v_contract_score, v_contract_state, v_contract_end
    from (
      select k.end_date,
             case
               when k.status in ('active', 'countersigned', 'renewed')
                    and (k.end_date is null or k.auto_renew or k.end_date >= current_date + 30) then 100
               when k.status in ('active', 'countersigned', 'renewed')
                    and k.end_date >= current_date then 50
               when k.status in ('sent', 'signed_by_client') then 70
               else 0
             end as score,
             case
               when k.status in ('active', 'countersigned', 'renewed')
                    and (k.end_date is null or k.auto_renew or k.end_date >= current_date + 30) then 'active'
               when k.status in ('active', 'countersigned', 'renewed')
                    and k.end_date >= current_date then 'expiring'
               when k.status in ('sent', 'signed_by_client') then 'pending'
               else 'expired'
             end as state
        from public.contracts k
       where k.client_id = p_client_id
         and k.status not in ('draft', 'cancelled')
    ) x
   order by x.score desc, x.end_date desc nulls first
   limit 1;

  -- Relationship, part 2: days since anything happened with the client.
  select max(e.occurred_at) into v_last_activity
    from public.client_timeline_events e
   where e.client_id = p_client_id;
  if v_last_activity is not null then
    v_days_inactive := greatest(0, current_date - v_last_activity::date);
    v_activity := case
      when v_days_inactive <= 14 then 100
      when v_days_inactive <= 30 then 70
      when v_days_inactive <= 60 then 40
      else 10
    end;
  end if;

  if v_contract_score is not null and v_activity is not null then
    v_relationship := round((v_contract_score + v_activity) / 2.0);
  else
    v_relationship := coalesce(v_contract_score, v_activity);
  end if;

  -- Total: weighted average of the components that have data.
  if v_payments is not null then v_weight := v_weight + 35; v_sum := v_sum + 35 * v_payments; end if;
  if v_delivery is not null then v_weight := v_weight + 30; v_sum := v_sum + 30 * v_delivery; end if;
  if v_approvals is not null then v_weight := v_weight + 20; v_sum := v_sum + 20 * v_approvals; end if;

  if v_weight > 0 then
    if v_relationship is not null then
      v_weight := v_weight + 15;
      v_sum := v_sum + 15 * v_relationship;
    end if;
    v_score := round(v_sum::numeric / v_weight);
  end if;

  return jsonb_build_object(
    'version', 1,
    'score', v_score,
    'reason', case when v_score is null then 'no_data' end,
    'components', jsonb_build_object(
      'payments', jsonb_build_object(
        'score', v_payments, 'weight', 35,
        'open_count', v_inv_open,
        'overdue_count', v_inv_overdue,
        'overdue_amount', v_inv_overdue_amount,
        'max_days_overdue', v_inv_max_days),
      'delivery', jsonb_build_object(
        'score', v_delivery, 'weight', 30,
        'open_tasks', v_tasks_open,
        'overdue_tasks', v_tasks_overdue),
      'approvals', jsonb_build_object(
        'score', v_approvals, 'weight', 20,
        'recent_posts', v_posts_recent,
        'changes_requested', v_posts_changes,
        'rejected', v_posts_reject,
        'stalled', v_posts_stalled),
      'relationship', jsonb_build_object(
        'score', v_relationship, 'weight', 15,
        'contract', v_contract_state,
        'contract_end_date', v_contract_end,
        'days_since_activity', v_days_inactive)
    )
  );
end;
$$;

-- 3. Storing it ---------------------------------------------------------------

create or replace function public.refresh_client_health(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_breakdown jsonb;
  v_score     smallint;
begin
  if p_client_id is null then
    return;
  end if;

  v_breakdown := public.compute_client_health(p_client_id);
  -- NULL = the client no longer exists (e.g. its rows are being cascade-deleted).
  if v_breakdown is null then
    return;
  end if;
  v_score := (v_breakdown ->> 'score')::smallint;

  insert into public.client_health (client_id, score, breakdown, computed_at)
  values (p_client_id, v_score, v_breakdown, now())
  on conflict (client_id) do update
    set score = excluded.score,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;

  -- Only touch the client row when the number changes, so updated_at isn't
  -- bumped by every recalculation.
  update public.clients c
     set health_score = v_score
   where c.id = p_client_id
     and c.health_score is distinct from v_score;
end;
$$;

create or replace function public.refresh_all_client_health()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.refresh_client_health(c.id) from public.clients c;
end;
$$;

-- Only triggers and pg_cron call these. Not exposed to the app: they bypass RLS.
revoke all on function public.compute_client_health(uuid) from public, anon, authenticated;
revoke all on function public.refresh_client_health(uuid) from public, anon, authenticated;
revoke all on function public.refresh_all_client_health() from public, anon, authenticated;
grant execute on function public.compute_client_health(uuid) to service_role;
grant execute on function public.refresh_client_health(uuid) to service_role;
grant execute on function public.refresh_all_client_health() to service_role;

-- 4. Clients: health_score is always the computed value ----------------------

create or replace function public.clients_set_health_score()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Whatever the caller sends is replaced by the stored calculation, so the
  -- score can't be set by hand through the API.
  if tg_op = 'INSERT' then
    new.health_score := null;
  else
    new.health_score := (select h.score from public.client_health h where h.client_id = new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.clients_set_health_score() from public, anon, authenticated;

drop trigger if exists trg_clients_set_health_score on public.clients;
create trigger trg_clients_set_health_score
before insert or update on public.clients
for each row execute function public.clients_set_health_score();

create or replace function public.clients_refresh_health()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.refresh_client_health(new.id);
  return null;
end;
$$;

revoke all on function public.clients_refresh_health() from public, anon, authenticated;

-- Status decides whether the client is scored at all (prospect / churned -> NULL).
drop trigger if exists trg_clients_refresh_health on public.clients;
create trigger trg_clients_refresh_health
after insert or update of status on public.clients
for each row execute function public.clients_refresh_health();

-- 5. Source tables: recalculate the affected client(s) ------------------------

-- Shared by every table that has a client_id column.
create or replace function public.refresh_client_health_on_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_client_health(new.client_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.client_id is distinct from new.client_id) then
    perform public.refresh_client_health(old.client_id);
  end if;
  return null;
end;
$$;

revoke all on function public.refresh_client_health_on_change() from public, anon, authenticated;

drop trigger if exists trg_invoices_refresh_client_health on public.invoices;
create trigger trg_invoices_refresh_client_health
after insert or delete or update of status, due_date, total, amount_paid, client_id on public.invoices
for each row execute function public.refresh_client_health_on_change();

drop trigger if exists trg_tasks_refresh_client_health on public.tasks;
create trigger trg_tasks_refresh_client_health
after insert or delete or update of status, due_date, client_id, parent_task_id on public.tasks
for each row execute function public.refresh_client_health_on_change();

drop trigger if exists trg_social_posts_refresh_client_health on public.social_posts;
create trigger trg_social_posts_refresh_client_health
after insert or delete or update of status, client_id, last_approval_sent_at on public.social_posts
for each row execute function public.refresh_client_health_on_change();

drop trigger if exists trg_contracts_refresh_client_health on public.contracts;
create trigger trg_contracts_refresh_client_health
after insert or delete or update of status, end_date, auto_renew, client_id on public.contracts
for each row execute function public.refresh_client_health_on_change();

-- 6. Daily recalculation -------------------------------------------------------

-- 09:00 UTC: after mark-overdue-invoices (06:30), recurring tasks (08:00) and
-- the contract lifecycle (08:30), so it sees their results.
select cron.schedule(
  'refresh-client-health-daily',
  '0 9 * * *',
  $cron$select public.refresh_all_client_health();$cron$
);

-- 7. Backfill ------------------------------------------------------------------

select public.refresh_all_client_health();

comment on column public.clients.health_score is
  'Automatic (0-100). Maintained by public.refresh_client_health via triggers and the refresh-client-health-daily cron; NULL for prospect/churned clients or when there is no data. Breakdown in public.client_health.';
comment on table public.client_health is
  'Per-client health score breakdown (see public.compute_client_health). Workspace members only; written by security definer functions.';
