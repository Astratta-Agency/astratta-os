-- ============================================================
-- 9.6 Tareas de creación de contenido (vinculadas) — schema
-- ============================================================

-- 1. FK real en tasks.related_post_id (no existía)
alter table public.tasks
  add constraint tasks_related_post_id_fkey
  foreign key (related_post_id) references public.social_posts(id) on delete set null;

-- 2. Columna para identificar subtareas auto-generadas (copywriting/design/review/scheduling/publishing)
alter table public.tasks
  add column if not exists content_subtask_key text;

-- evita que el trigger duplique la misma subtarea para el mismo post
create unique index if not exists tasks_post_subtask_unique
  on public.tasks (related_post_id, content_subtask_key)
  where content_subtask_key is not null;

-- 3. Plantillas de subtareas por tipo de contenido (configurable en Settings)
create table public.content_task_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_type post_type, -- null = aplica a todos los tipos de post
  subtask_key text not null, -- 'copywriting' | 'design' | 'review' | 'scheduling' | 'publishing' (o custom)
  title text not null, -- soporta placeholder {{post_title}}
  task_type task_type not null default 'produccion',
  default_role text, -- 'content_creator' | 'designer' | null (sin asignar)
  offset_days integer not null default 0, -- días antes de scheduled_for
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_task_templates enable row level security;

create policy content_task_templates_select_member
  on public.content_task_templates for select
  using (is_workspace_member(workspace_id));

create policy content_task_templates_write_writer
  on public.content_task_templates for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create trigger set_content_task_templates_updated_at
  before update on public.content_task_templates
  for each row execute function public.set_updated_at();

-- 4. Responsable default por cliente + rol (content_creator / designer)
create table public.client_content_roles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  role_key text not null, -- 'content_creator' | 'designer'
  member_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, role_key)
);

alter table public.client_content_roles enable row level security;

create policy client_content_roles_select_member
  on public.client_content_roles for select
  using (is_workspace_member((select workspace_id from public.clients where id = client_id)));

create policy client_content_roles_write_writer
  on public.client_content_roles for all
  using (can_write_workspace((select workspace_id from public.clients where id = client_id)))
  with check (can_write_workspace((select workspace_id from public.clients where id = client_id)));

create trigger set_client_content_roles_updated_at
  before update on public.client_content_roles
  for each row execute function public.set_updated_at();

-- 5. Trigger: al pasar un post a "draft" (desde idea, o creado directo en draft),
--    genera las subtareas según las plantillas activas del workspace.
create or replace function public.generate_content_subtasks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tmpl record;
  resolved_assignee uuid;
  computed_due date;
begin
  if NEW.status is distinct from 'draft' then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'draft' then
    return NEW; -- ya se generaron, no repetir en cada edición posterior
  end if;

  for tmpl in
    select * from public.content_task_templates
    where workspace_id = NEW.workspace_id
      and is_active
      and (post_type is null or post_type = NEW.type)
    order by sort_order
  loop
    resolved_assignee := null;
    if tmpl.default_role is not null then
      select member_user_id into resolved_assignee
      from public.client_content_roles
      where client_id = NEW.client_id and role_key = tmpl.default_role;
    end if;

    computed_due := case when NEW.scheduled_for is not null
      then (NEW.scheduled_for::date - tmpl.offset_days)
      else null end;

    insert into public.tasks (
      workspace_id, project_id, client_id, title, assigned_to,
      status, priority, due_date, related_post_id, created_by,
      type, content_subtask_key
    ) values (
      NEW.workspace_id, NEW.project_id, NEW.client_id,
      replace(tmpl.title, '{{post_title}}', NEW.title),
      resolved_assignee, 'todo', 'p2', computed_due,
      NEW.id, NEW.created_by, tmpl.task_type, tmpl.subtask_key
    )
    on conflict (related_post_id, content_subtask_key) where content_subtask_key is not null
    do nothing;
  end loop;

  return NEW;
end;
$$;

-- solo debe dispararse como trigger, no ser invocable por RPC (mismo hardening que el resto del esquema)
revoke execute on function public.generate_content_subtasks() from public, anon, authenticated;

create trigger tl_generate_content_subtasks
  after insert or update of status on public.social_posts
  for each row
  execute function public.generate_content_subtasks();
