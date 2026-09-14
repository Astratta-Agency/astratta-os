-- Tabla de actividad / timeline de tareas
create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null,
  actor_id uuid,
  action text not null, -- 'created' | 'field_changed'
  field text,           -- 'status' | 'assigned_to' | 'title' | ...
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index task_activity_task_id_idx on public.task_activity (task_id, created_at desc);

alter table public.task_activity enable row level security;

-- Solo lectura para miembros del workspace; las escrituras las hace el trigger (security definer)
create policy activity_select_member on public.task_activity
  for select using (is_workspace_member(workspace_id));

-- Función del trigger
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

  -- UPDATE: registrar cada campo relevante que cambió
  if new.status is distinct from old.status then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'status', old.status::text, new.status::text);
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into task_activity (task_id, workspace_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.workspace_id, v_actor, 'field_changed', 'assigned_to', old.assigned_to::text, new.assigned_to::text);
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

create trigger trg_log_task_activity
after insert or update on public.tasks
for each row execute function public.log_task_activity();
