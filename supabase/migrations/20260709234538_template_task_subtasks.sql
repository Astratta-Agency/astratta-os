-- Subtareas en plantillas de proyectos
alter table public.project_template_tasks
  add column parent_id uuid references public.project_template_tasks(id) on delete cascade;

create index idx_project_template_tasks_parent on public.project_template_tasks(parent_id);

-- Evitar anidación de más de un nivel (una subtarea no puede tener hijos)
create or replace function public.check_template_task_depth()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if NEW.parent_id is not null then
    if exists (
      select 1 from public.project_template_tasks
      where id = NEW.parent_id and parent_id is not null
    ) then
      raise exception 'Las subtareas no pueden tener subtareas (máximo un nivel)';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_check_template_task_depth
  before insert or update of parent_id on public.project_template_tasks
  for each row execute function public.check_template_task_depth();

-- Recrear el trigger de aplicación de plantilla con soporte de subtareas
create or replace function public.apply_project_template()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_template_id uuid;
  v_base_date date;
  v_task record;
  v_new_task_id uuid;
  v_item text;
  v_pos integer;
  v_parent_map jsonb := '{}'::jsonb;
begin
  select id into v_template_id
  from public.project_templates
  where workspace_id = NEW.workspace_id
    and project_type = NEW.type
    and is_default = true
    and is_active = true
  limit 1;

  if v_template_id is null then
    return NEW;
  end if;

  v_base_date := coalesce(NEW.start_date, current_date);

  -- Pase 1: tareas padre / de nivel superior
  for v_task in
    select * from public.project_template_tasks
    where template_id = v_template_id and parent_id is null
    order by position asc, created_at asc
  loop
    insert into public.tasks (
      workspace_id, project_id, client_id, title, description, type, priority,
      due_date, estimated_hours, status
    ) values (
      NEW.workspace_id, NEW.id, NEW.client_id, v_task.title, v_task.description, v_task.type, v_task.priority,
      v_base_date + v_task.offset_days, v_task.estimated_hours, 'todo'
    ) returning id into v_new_task_id;

    v_parent_map := v_parent_map || jsonb_build_object(v_task.id::text, v_new_task_id::text);

    v_pos := 0;
    if v_task.checklist_items is not null then
      foreach v_item in array v_task.checklist_items loop
        insert into public.task_checklist_items (task_id, title, position)
        values (v_new_task_id, v_item, v_pos);
        v_pos := v_pos + 1;
      end loop;
    end if;
  end loop;

  -- Pase 2: subtareas, vinculadas a su tarea padre recién creada
  for v_task in
    select * from public.project_template_tasks
    where template_id = v_template_id and parent_id is not null
    order by position asc, created_at asc
  loop
    insert into public.tasks (
      workspace_id, project_id, client_id, parent_task_id, title, description, type, priority,
      due_date, estimated_hours, status
    ) values (
      NEW.workspace_id, NEW.id, NEW.client_id,
      (v_parent_map ->> v_task.parent_id::text)::uuid,
      v_task.title, v_task.description, v_task.type, v_task.priority,
      v_base_date + v_task.offset_days, v_task.estimated_hours, 'todo'
    ) returning id into v_new_task_id;

    v_pos := 0;
    if v_task.checklist_items is not null then
      foreach v_item in array v_task.checklist_items loop
        insert into public.task_checklist_items (task_id, title, position)
        values (v_new_task_id, v_item, v_pos);
        v_pos := v_pos + 1;
      end loop;
    end if;
  end loop;

  return NEW;
end;
$function$;
