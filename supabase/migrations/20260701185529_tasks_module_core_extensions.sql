-- ============================================================
-- Módulo Tareas (spec 6.1-6.2) — extensión del esquema núcleo
-- ============================================================

-- 6.1: Tipo de tarea
create type public.task_type as enum ('produccion', 'revision', 'aprobacion', 'reunion', 'admin');

-- Extender tasks: tipo, tags, timer en vivo, horas estimadas, vínculo a lead
alter table public.tasks
  add column type public.task_type not null default 'produccion',
  add column estimated_hours numeric(6,2),
  add column tags text[] not null default '{}',
  add column timer_started_at timestamptz,
  add column timer_started_by uuid,
  add column lead_id uuid references public.leads(id) on delete set null;

comment on column public.tasks.lead_id is 'Vínculo opcional a un lead del pipeline de ventas (ej. tareas de onboarding creadas antes de convertir el lead a cliente).';

create index idx_tasks_assigned_to on public.tasks(assigned_to);
create index idx_tasks_workspace_status on public.tasks(workspace_id, status);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_lead_id on public.tasks(lead_id);

-- 6.1: Tiempo estimado vs registrado — vincular time_entries a una tarea
alter table public.time_entries
  add column task_id uuid references public.tasks(id) on delete set null;

create index idx_time_entries_task_id on public.time_entries(task_id);

-- 6.1: Subtareas / checklist
create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_task_checklist_items_task_id on public.task_checklist_items(task_id);

alter table public.task_checklist_items enable row level security;

create policy checklist_select_member on public.task_checklist_items
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

create policy checklist_write_member on public.task_checklist_items
  for all using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  ) with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

-- 6.1: Comentarios
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_task_comments_task_id on public.task_comments(task_id);

alter table public.task_comments enable row level security;

create policy comments_select_member on public.task_comments
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

create policy comments_insert_member on public.task_comments
  for insert with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

create policy comments_delete_author_or_writer on public.task_comments
  for delete using (
    author_id = (select auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and public.can_write_workspace(t.workspace_id))
  );

-- 6.1: Archivos adjuntos
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index idx_task_attachments_task_id on public.task_attachments(task_id);

alter table public.task_attachments enable row level security;

create policy attachments_select_member on public.task_attachments
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

create policy attachments_insert_member on public.task_attachments
  for insert with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
  );

create policy attachments_delete_uploader_or_writer on public.task_attachments
  for delete using (
    uploaded_by = (select auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and public.can_write_workspace(t.workspace_id))
  );

-- Storage bucket para adjuntos de tareas (privado, path convention: {workspace_id}/{task_id}/{filename})
insert into storage.buckets (id, name, public) values ('task-attachments', 'task-attachments', false);

create policy "task-attachments select member" on storage.objects
  for select using (
    bucket_id = 'task-attachments' and auth.uid() is not null
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "task-attachments insert member" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments' and auth.uid() is not null
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "task-attachments delete member" on storage.objects
  for delete using (
    bucket_id = 'task-attachments' and auth.uid() is not null
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Función para detener el timer en vivo de una tarea (SECURITY INVOKER: respeta RLS del caller)
create or replace function public.stop_task_timer(p_task_id uuid, p_note text default null)
returns public.time_entries
language plpgsql
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
