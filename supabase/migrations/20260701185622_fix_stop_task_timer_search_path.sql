create or replace function public.stop_task_timer(p_task_id uuid, p_note text default null)
returns public.time_entries
language plpgsql
set search_path = 'public'
as $$
declare
  v_task public.tasks;
  v_hours numeric(6,2);
  v_entry public.time_entries;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarea no encontrada';
  end if;
  if v_task.timer_started_at is null then
    raise exception 'Esta tarea no tiene un timer activo';
  end if;

  v_hours := round(extract(epoch from (now() - v_task.timer_started_at)) / 3600.0, 2);
  if v_hours <= 0 then
    v_hours := 0.01;
  end if;

  insert into public.time_entries (workspace_id, user_id, client_id, project_id, task_id, entry_date, hours, billable, note)
  values (v_task.workspace_id, auth.uid(), v_task.client_id, v_task.project_id, v_task.id, current_date, v_hours, true, coalesce(p_note, 'Timer registrado desde la tarea'))
  returning * into v_entry;

  update public.tasks set timer_started_at = null, timer_started_by = null, updated_at = now()
  where id = p_task_id;

  return v_entry;
end;
$$;
