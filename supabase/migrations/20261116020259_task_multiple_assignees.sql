-- Multiple assignees per task.
--
-- Source of truth moves to public.task_assignees (task_id, user_id).
-- tasks.assigned_to is kept as a deprecated "primary assignee" column so older
-- clients, the Google Calendar edge function and content-template inserts keep
-- working: it is always the earliest-added assignee (or null), maintained by
-- trigger. Legacy writers that insert/update tasks.assigned_to get that user
-- added to task_assignees (add-only; removals must go through task_assignees /
-- set_task_assignees()).

-- 1. Table ------------------------------------------------------------------

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid default auth.uid(),
  primary key (task_id, user_id)
);

create index task_assignees_user_id_idx on public.task_assignees (user_id);

-- 2. Helper used by RLS -------------------------------------------------------

create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = p_task_id and user_id = (select auth.uid())
  )
$$;

revoke execute on function public.is_task_assignee(uuid) from public, anon;
grant execute on function public.is_task_assignee(uuid) to authenticated, service_role;

-- 3. RLS + grants -------------------------------------------------------------

alter table public.task_assignees enable row level security;

create policy task_assignees_select_member on public.task_assignees
  for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_assignees.task_id and public.is_workspace_member(t.workspace_id)
  ));

-- Same people who can already change a task's assignee: workspace writers, the
-- task creator (tasks_insert_member lets any member create with an assignee) and
-- current assignees.
create policy task_assignees_insert_member on public.task_assignees
  for insert to authenticated
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_assignees.task_id
      and public.is_workspace_member(t.workspace_id)
      and (
        public.can_write_workspace(t.workspace_id)
        or t.created_by = (select auth.uid())
        or public.is_task_assignee(t.id)
      )
  ));

create policy task_assignees_delete_member on public.task_assignees
  for delete to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_assignees.task_id
      and public.is_workspace_member(t.workspace_id)
      and (
        public.can_write_workspace(t.workspace_id)
        or t.created_by = (select auth.uid())
        or public.is_task_assignee(t.id)
      )
  ));

revoke all on public.task_assignees from public, anon, authenticated;
grant select, insert, delete on public.task_assignees to authenticated;
grant all on public.task_assignees to service_role;

-- tasks update: any assignee (not only the primary) may edit the task.
drop policy if exists tasks_update_assignee_or_writer on public.tasks;
create policy tasks_update_assignee_or_writer on public.tasks
  for update
  using (
    public.is_workspace_member(workspace_id)
    and (public.is_task_assignee(id) or assigned_to = (select auth.uid()) or public.can_write_workspace(workspace_id))
  )
  with check (
    public.is_workspace_member(workspace_id)
    and (public.is_task_assignee(id) or assigned_to = (select auth.uid()) or public.can_write_workspace(workspace_id))
  );

-- 4. Backfill (before any trigger exists, so nobody gets re-notified) ---------

insert into public.task_assignees (task_id, user_id)
select t.id, t.assigned_to
from public.tasks t
join auth.users u on u.id = t.assigned_to
where t.assigned_to is not null
on conflict do nothing;

alter table public.task_recurrence_rules
  add column assignee_ids uuid[] not null default '{}';

update public.task_recurrence_rules
set assignee_ids = array[assigned_to]
where assigned_to is not null;

-- 5. Keep tasks.assigned_to (primary) in sync -----------------------------------

create or replace function public.sync_task_primary_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_primary uuid;
begin
  select user_id into v_primary
  from public.task_assignees
  where task_id = v_task
  order by created_at, user_id
  limit 1;

  update public.tasks set assigned_to = v_primary
  where id = v_task and assigned_to is distinct from v_primary;

  return null;
end;
$$;

revoke execute on function public.sync_task_primary_assignee() from public, anon, authenticated;

create trigger trg_task_assignees_sync_primary
  after insert or delete on public.task_assignees
  for each row execute function public.sync_task_primary_assignee();

-- Legacy writers (generate_content_subtasks, old clients): an assigned_to on
-- tasks becomes an assignee row. Idempotent, so the feedback from the trigger
-- above is harmless.
create or replace function public.tasks_add_legacy_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null then
    insert into public.task_assignees (task_id, user_id)
    values (new.id, new.assigned_to)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function public.tasks_add_legacy_assignee() from public, anon, authenticated;

create trigger trg_tasks_add_legacy_assignee
  after insert on public.tasks
  for each row execute function public.tasks_add_legacy_assignee();

create trigger trg_tasks_add_legacy_assignee_upd
  after update of assigned_to on public.tasks
  for each row
  when (new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to)
  execute function public.tasks_add_legacy_assignee();

-- 6. Notifications: one per assignee added --------------------------------------

drop trigger if exists trg_notify_task_assigned on public.tasks;
drop function if exists public.notify_task_assigned();

create or replace function public.notify_task_assignee_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  select id, workspace_id, title, description into t from public.tasks where id = new.task_id;
  if not found then
    return null;
  end if;

  insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link)
  values (
    t.workspace_id, new.user_id, 'task_assigned',
    'Nueva tarea asignada: ' || t.title,
    coalesce(t.description, ''),
    '/app/tareas?task=' || t.id::text
  );
  return null;
end;
$$;

revoke execute on function public.notify_task_assignee_added() from public, anon, authenticated;

create trigger trg_notify_task_assignee_added
  after insert on public.task_assignees
  for each row execute function public.notify_task_assignee_added();

-- 7. Activity timeline ----------------------------------------------------------

create or replace function public.log_task_assignee_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_ws uuid;
begin
  -- On task deletion the cascade removes assignees after the task row is gone.
  select workspace_id into v_ws from public.tasks where id = v_task;
  if v_ws is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (v_task, v_ws, auth.uid(), 'field_changed', 'assigned_to', null, new.user_id::text);
  else
    insert into public.task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (v_task, v_ws, auth.uid(), 'field_changed', 'assigned_to', old.user_id::text, null);
  end if;
  return null;
end;
$$;

revoke execute on function public.log_task_assignee_activity() from public, anon, authenticated;

create trigger trg_log_task_assignee_activity
  after insert or delete on public.task_assignees
  for each row execute function public.log_task_assignee_activity();

-- The primary-assignee column is now a derived value; do not log it twice.
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into task_activity (task_id, workspace_id, actor_id, action)
    values (new.id, new.workspace_id, v_actor, 'created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'status', old.status::text, new.status::text);
  end if;

  if new.title is distinct from old.title then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'title', old.title, new.title);
  end if;

  if new.description is distinct from old.description then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'description', null, null);
  end if;

  if new.priority is distinct from old.priority then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'priority', old.priority::text, new.priority::text);
  end if;

  if new.type is distinct from old.type then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'type', old.type::text, new.type::text);
  end if;

  if new.due_date is distinct from old.due_date then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'due_date', old.due_date::text, new.due_date::text);
  end if;

  if new.estimated_hours is distinct from old.estimated_hours then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'estimated_hours', old.estimated_hours::text, new.estimated_hours::text);
  end if;

  if new.tags is distinct from old.tags then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'tags', array_to_string(old.tags, ', '), array_to_string(new.tags, ', '));
  end if;

  if new.project_id is distinct from old.project_id then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'project_id', old.project_id::text, new.project_id::text);
  end if;

  if new.client_id is distinct from old.client_id then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'client_id', old.client_id::text, new.client_id::text);
  end if;

  if new.lead_id is distinct from old.lead_id then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'lead_id', old.lead_id::text, new.lead_id::text);
  end if;

  return new;
end;
$$;

-- 8. Replace all assignees of a task atomically (RLS applies: SECURITY INVOKER) ------

create or replace function public.set_task_assignees(p_task_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_user_ids, '{}');
begin
  delete from public.task_assignees
  where task_id = p_task_id and user_id <> all (v_ids);

  insert into public.task_assignees (task_id, user_id)
  select p_task_id, u from (select distinct unnest(v_ids) as u) s
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_task_assignees(uuid, uuid[]) from public, anon;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated, service_role;

-- 9. Recurring tasks: copy every assignee of the rule -------------------------------

create or replace function public.generate_recurring_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_next date;
  v_iterations integer;
  v_ids uuid[];
  v_task_id uuid;
begin
  for r in select * from public.task_recurrence_rules where is_active = true and next_run_date <= current_date loop
    v_next := r.next_run_date;
    v_iterations := 0;
    v_ids := case
      when coalesce(cardinality(r.assignee_ids), 0) > 0 then r.assignee_ids
      when r.assigned_to is not null then array[r.assigned_to]
      else '{}'::uuid[]
    end;

    while v_next <= current_date and v_iterations < 12 loop
      insert into public.tasks (
        workspace_id, project_id, client_id, title, description, type, priority,
        due_date, tags, estimated_hours, created_by
      ) values (
        r.workspace_id, r.project_id, r.client_id, r.title, r.description, r.type, r.priority,
        v_next, r.tags, r.estimated_hours, r.created_by
      ) returning id into v_task_id;

      insert into public.task_assignees (task_id, user_id)
      select v_task_id, u from unnest(v_ids) u
      on conflict do nothing;

      if r.frequency = 'daily' then
        v_next := v_next + 1;
      elsif r.frequency = 'weekly' then
        v_next := v_next + 7;
      else
        v_next := (v_next + interval '1 month')::date;
      end if;

      v_iterations := v_iterations + 1;
    end loop;

    update public.task_recurrence_rules set next_run_date = v_next, updated_at = now() where id = r.id;
  end loop;
end;
$$;
