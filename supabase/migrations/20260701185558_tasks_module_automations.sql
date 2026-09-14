-- ============================================================
-- Módulo Tareas (spec 6.3) — automatizaciones
-- ============================================================

-- Ampliar tipos de notificación permitidos (lección aprendida en Sales/Pipeline:
-- el constraint se olvida fácil de actualizar al agregar triggers nuevos)
alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'post_approved'::text,
    'post_rejected'::text,
    'post_changes_requested'::text,
    'invite_accepted'::text,
    'payment_received'::text,
    'contract_expiring'::text,
    'new_lead'::text,
    'proposal_signed'::text,
    'task_assigned'::text
  ]));

-- Tareas recurrentes (ej: "auditar IG insights" cada lunes)
create table public.task_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  type public.task_type not null default 'admin',
  priority public.task_priority not null default 'p2',
  assigned_to uuid,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  tags text[] not null default '{}',
  estimated_hours numeric(6,2),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 31),
  next_run_date date not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_task_recurrence_rules_workspace on public.task_recurrence_rules(workspace_id);
create index idx_task_recurrence_rules_next_run on public.task_recurrence_rules(next_run_date) where is_active = true;

alter table public.task_recurrence_rules enable row level security;

create policy recurrence_select_member on public.task_recurrence_rules
  for select using (public.is_workspace_member(workspace_id));

create policy recurrence_write_writer on public.task_recurrence_rules
  for all using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- Generador de tareas recurrentes (invocado por pg_cron una vez al día)
create or replace function public.generate_recurring_tasks()
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  r record;
  v_next date;
  v_iterations integer;
begin
  for r in select * from public.task_recurrence_rules where is_active = true and next_run_date <= current_date loop
    v_next := r.next_run_date;
    v_iterations := 0;

    while v_next <= current_date and v_iterations < 12 loop
      insert into public.tasks (
        workspace_id, project_id, client_id, title, description, type, priority,
        assigned_to, due_date, tags, estimated_hours, created_by
      ) values (
        r.workspace_id, r.project_id, r.client_id, r.title, r.description, r.type, r.priority,
        r.assigned_to, v_next, r.tags, r.estimated_hours, r.created_by
      );

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

revoke execute on function public.generate_recurring_tasks() from public, anon, authenticated;

-- Programar el generador diario vía pg_cron
create extension if not exists pg_cron;

select cron.schedule(
  'generate-recurring-tasks-daily',
  '0 8 * * *',
  $$select public.generate_recurring_tasks();$$
);

-- Notificar al usuario asignado cuando se le asigna una tarea
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if NEW.assigned_to is not null and (TG_OP = 'INSERT' or NEW.assigned_to is distinct from OLD.assigned_to) then
    if coalesce(
      (select np.in_app_enabled from public.notification_preferences np
       where np.workspace_id = NEW.workspace_id and np.user_id = NEW.assigned_to and np.event_type = 'task_assigned'),
      true
    ) then
      insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link)
      values (
        NEW.workspace_id, NEW.assigned_to, 'task_assigned',
        'Nueva tarea asignada: ' || NEW.title,
        coalesce(NEW.description, ''),
        '/app/tareas?task=' || NEW.id::text
      );
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.notify_task_assigned() from public, anon, authenticated;

create trigger trg_notify_task_assigned
  after insert or update on public.tasks
  for each row execute function public.notify_task_assigned();

-- Trigger 6.3: propuesta firmada → crear tareas de onboarding
create or replace function public.trg_create_onboarding_tasks()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_lead public.leads;
begin
  if NEW.status = 'signed' and (OLD.status is distinct from 'signed') then
    select * into v_lead from public.leads where id = NEW.lead_id;
    if v_lead.id is not null then
      insert into public.tasks (workspace_id, lead_id, title, description, type, priority, due_date, created_by)
      values
        (NEW.workspace_id, v_lead.id, 'Enviar bienvenida a ' || v_lead.company_name, 'Mandar email/mensaje de bienvenida tras la firma de la propuesta.', 'admin', 'p1', current_date + 1, NEW.created_by),
        (NEW.workspace_id, v_lead.id, 'Solicitar accesos y credenciales', 'Pedir accesos a redes sociales, sitio web y demás plataformas necesarias.', 'admin', 'p1', current_date + 2, NEW.created_by),
        (NEW.workspace_id, v_lead.id, 'Agendar llamada de kickoff', 'Coordinar la primera reunión de arranque del proyecto.', 'reunion', 'p1', current_date + 3, NEW.created_by),
        (NEW.workspace_id, v_lead.id, 'Convertir lead a cliente en Astratta OS', 'Usar la acción "Convertir a cliente" en el pipeline una vez confirmado el arranque.', 'admin', 'p0', current_date + 1, NEW.created_by),
        (NEW.workspace_id, v_lead.id, 'Configurar pilares de contenido', 'Definir los pilares de contenido iniciales para el nuevo cliente.', 'produccion', 'p2', current_date + 5, NEW.created_by);
    end if;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_create_onboarding_tasks() from public, anon, authenticated;

create trigger trg_proposals_create_onboarding_tasks
  after update on public.proposals
  for each row execute function public.trg_create_onboarding_tasks();
