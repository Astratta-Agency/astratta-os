-- project_templates
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_type public.project_type not null,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_project_templates_one_default
  on public.project_templates (workspace_id, project_type)
  where is_default = true;

create index idx_project_templates_workspace on public.project_templates(workspace_id);

alter table public.project_templates enable row level security;

create policy "project_templates_select_member" on public.project_templates
  for select using (is_workspace_member(workspace_id));

create policy "project_templates_write_writer" on public.project_templates
  for all using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

-- project_template_tasks
create table public.project_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates(id) on delete cascade,
  title text not null,
  description text,
  type public.task_type not null default 'produccion',
  priority public.task_priority not null default 'p2',
  offset_days integer not null default 0,
  estimated_hours numeric(6,2),
  checklist_items text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_template_tasks_template on public.project_template_tasks(template_id);

alter table public.project_template_tasks enable row level security;

create policy "project_template_tasks_select_member" on public.project_template_tasks
  for select using (
    exists (select 1 from public.project_templates pt where pt.id = template_id and is_workspace_member(pt.workspace_id))
  );

create policy "project_template_tasks_write_writer" on public.project_template_tasks
  for all using (
    exists (select 1 from public.project_templates pt where pt.id = template_id and can_write_workspace(pt.workspace_id))
  )
  with check (
    exists (select 1 from public.project_templates pt where pt.id = template_id and can_write_workspace(pt.workspace_id))
  );

-- trigger function: applies the default active template for the project's type on insert
create or replace function public.apply_project_template()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_template_id uuid;
  v_base_date date;
  v_task record;
  v_new_task_id uuid;
  v_item text;
  v_pos integer;
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

  for v_task in
    select * from public.project_template_tasks
    where template_id = v_template_id
    order by position asc, created_at asc
  loop
    insert into public.tasks (
      workspace_id, project_id, client_id, title, description, type, priority,
      due_date, estimated_hours, status
    ) values (
      NEW.workspace_id, NEW.id, NEW.client_id, v_task.title, v_task.description, v_task.type, v_task.priority,
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
$$;

revoke execute on function public.apply_project_template() from public, anon, authenticated;

create trigger trg_apply_project_template
after insert on public.projects
for each row execute function public.apply_project_template();
