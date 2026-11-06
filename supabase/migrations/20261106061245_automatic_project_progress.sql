-- Automatic project progress.
--
-- Before: projects.progress was a manual override (slider in "Editar
-- proyecto"). When it was NULL the app fell back to a time-based estimate.
--
-- After: projects.progress is maintained by the database and can no longer be
-- set by hand. Rule (public.compute_project_progress):
--   * status delivered / closed      -> 100
--   * project has tasks              -> % of its tasks with status 'done'.
--     Only "leaf" tasks count: a task that has subtasks is represented by its
--     subtasks, so a parent with 10 subtasks doesn't count as 11 items.
--   * project has no tasks           -> NULL (the app shows the time-based
--     estimate from start_date / end_date, as before).
--
-- It is recalculated whenever a task is created, deleted, changes status,
-- moves to another project or gets/loses a parent, and whenever a project row
-- is written (so manual values sent by old clients are overwritten).

-- 1. Calculation --------------------------------------------------------------

-- % of the project's leaf tasks that are done; NULL when it has no tasks.
create or replace function public.project_task_progress(p_project_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when count(*) = 0 then null
              else round(count(*) filter (where t.status = 'done') * 100.0 / count(*))::smallint
         end
  from public.tasks t
  where t.project_id = p_project_id
    and not exists (select 1 from public.tasks c where c.parent_task_id = t.id);
$$;

create or replace function public.compute_project_progress(p_project_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p.status in ('delivered', 'closed') then 100::smallint
              else public.project_task_progress(p.id)
         end
  from public.projects p
  where p.id = p_project_id;
$$;

-- Only the triggers below (security definer) call these. Not exposed to
-- authenticated: they bypass RLS and would reveal task counts of any project.
revoke all on function public.project_task_progress(uuid) from public, anon, authenticated;
revoke all on function public.compute_project_progress(uuid) from public, anon, authenticated;
grant execute on function public.project_task_progress(uuid) to service_role;
grant execute on function public.compute_project_progress(uuid) to service_role;

-- 2. Projects: progress is always the computed value ------------------------

create or replace function public.projects_set_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Uses NEW.status (not the stored row) so a status change in this same
  -- update is taken into account. On INSERT there are no tasks yet; templates
  -- add them afterwards and the tasks trigger recalculates.
  new.progress := case
    when new.status in ('delivered', 'closed') then 100
    when tg_op = 'INSERT' then null
    else public.project_task_progress(new.id)
  end;
  return new;
end;
$$;

revoke all on function public.projects_set_progress() from public, anon, authenticated;

drop trigger if exists trg_projects_set_progress on public.projects;
create trigger trg_projects_set_progress
before insert or update on public.projects
for each row execute function public.projects_set_progress();

-- 3. Tasks: recalculate the affected project(s) ------------------------------

create or replace function public.tasks_refresh_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[] := '{}';
begin
  if tg_op in ('INSERT', 'UPDATE') then
    v_ids := v_ids || new.project_id;
    -- A new subtask turns its parent into a non-leaf in the parent's project.
    if new.parent_task_id is not null then
      v_ids := v_ids || (select project_id from public.tasks where id = new.parent_task_id);
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_ids := v_ids || old.project_id;
    if old.parent_task_id is not null then
      v_ids := v_ids || (select project_id from public.tasks where id = old.parent_task_id);
    end if;
  end if;

  -- The BEFORE trigger on projects recomputes progress; only touch rows whose
  -- value actually changes so updated_at isn't bumped needlessly.
  update public.projects p
     set progress = public.compute_project_progress(p.id)
   where p.id = any (v_ids)
     and p.progress is distinct from public.compute_project_progress(p.id);

  return null;
end;
$$;

revoke all on function public.tasks_refresh_project_progress() from public, anon, authenticated;

drop trigger if exists trg_tasks_refresh_project_progress on public.tasks;
create trigger trg_tasks_refresh_project_progress
after insert or delete or update of status, project_id, parent_task_id on public.tasks
for each row execute function public.tasks_refresh_project_progress();

-- 4. Backfill (replaces the old manual values) -------------------------------

update public.projects
   set progress = public.compute_project_progress(id)
 where progress is distinct from public.compute_project_progress(id);

comment on column public.projects.progress is
  'Automatic (0-100). Maintained by trg_projects_set_progress / trg_tasks_refresh_project_progress: 100 when delivered/closed, else % of leaf tasks done, NULL when the project has no tasks.';
