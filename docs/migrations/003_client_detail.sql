-- =====================================================================
-- Astratta OS — Client detail page tables (Migration 003)
-- Adds: client_notes (markdown body, one per client) + client_timeline_events
-- with auto-population triggers. Apply via Supabase SQL Editor.
-- =====================================================================

-- ---------- client_notes -----------------------------------------------
create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  body_md text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_notes_client on public.client_notes (client_id);

drop trigger if exists trg_client_notes_updated_at on public.client_notes;
create trigger trg_client_notes_updated_at before update on public.client_notes
  for each row execute function public.set_updated_at();

alter table public.client_notes enable row level security;
alter table public.client_notes force row level security;

drop policy if exists "client_notes_select_member" on public.client_notes;
create policy "client_notes_select_member" on public.client_notes for select to authenticated
  using (public.client_in_member_workspace(client_id));

drop policy if exists "client_notes_write_member" on public.client_notes;
create policy "client_notes_write_member" on public.client_notes for all to authenticated
  using (public.client_in_member_workspace(client_id))
  with check (public.client_in_member_workspace(client_id));

-- ---------- client_timeline_events -------------------------------------
create table if not exists public.client_timeline_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in (
    'client_created','client_updated','project_created','project_status_changed',
    'contact_added','contact_updated','note_updated','manual'
  )),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_timeline_client_occurred
  on public.client_timeline_events (client_id, occurred_at desc);

alter table public.client_timeline_events enable row level security;
alter table public.client_timeline_events force row level security;

drop policy if exists "timeline_select_member" on public.client_timeline_events;
create policy "timeline_select_member" on public.client_timeline_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "timeline_insert_member" on public.client_timeline_events;
create policy "timeline_insert_member" on public.client_timeline_events for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

-- ---------- Trigger functions ------------------------------------------
create or replace function public.tl_on_client_insert()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id, occurred_at)
  values (new.id, new.workspace_id, 'client_created', 'Cliente creado: ' || new.name, auth.uid(), new.created_at);
  return new;
end; $$;

create or replace function public.tl_on_client_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id)
    values (new.id, new.workspace_id, 'client_updated',
      'Status: ' || old.status || ' → ' || new.status, auth.uid());
  end if;
  return new;
end; $$;

create or replace function public.tl_on_project_insert()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.client_timeline_events (client_id, workspace_id, event_type, title, description, actor_id, metadata)
  values (new.client_id, new.workspace_id, 'project_created',
    'Proyecto creado: ' || new.name, new.type::text, auth.uid(),
    jsonb_build_object('project_id', new.id, 'type', new.type));
  return new;
end; $$;

create or replace function public.tl_on_project_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id, metadata)
    values (new.client_id, new.workspace_id, 'project_status_changed',
      new.name || ': ' || old.status || ' → ' || new.status, auth.uid(),
      jsonb_build_object('project_id', new.id));
  end if;
  return new;
end; $$;

create or replace function public.tl_on_contact_insert()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare wsid uuid;
begin
  select workspace_id into wsid from public.clients where id = new.client_id;
  if wsid is null then return new; end if;
  insert into public.client_timeline_events (client_id, workspace_id, event_type, title, description, actor_id)
  values (new.client_id, wsid, 'contact_added',
    'Contacto agregado: ' || new.name, coalesce(new.role, new.email), auth.uid());
  return new;
end; $$;

create or replace function public.tl_on_note_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare wsid uuid;
begin
  select workspace_id into wsid from public.clients where id = new.client_id;
  if wsid is null then return new; end if;
  if new.body_md is distinct from coalesce(old.body_md, '') then
    insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id)
    values (new.client_id, wsid, 'note_updated', 'Notas internas actualizadas', auth.uid());
  end if;
  return new;
end; $$;

drop trigger if exists trg_tl_client_insert on public.clients;
create trigger trg_tl_client_insert after insert on public.clients
  for each row execute function public.tl_on_client_insert();

drop trigger if exists trg_tl_client_update on public.clients;
create trigger trg_tl_client_update after update on public.clients
  for each row execute function public.tl_on_client_update();

drop trigger if exists trg_tl_project_insert on public.projects;
create trigger trg_tl_project_insert after insert on public.projects
  for each row execute function public.tl_on_project_insert();

drop trigger if exists trg_tl_project_update on public.projects;
create trigger trg_tl_project_update after update on public.projects
  for each row execute function public.tl_on_project_update();

drop trigger if exists trg_tl_contact_insert on public.client_contacts;
create trigger trg_tl_contact_insert after insert on public.client_contacts
  for each row execute function public.tl_on_contact_insert();

drop trigger if exists trg_tl_note_update on public.client_notes;
create trigger trg_tl_note_update after update on public.client_notes
  for each row execute function public.tl_on_note_update();

-- ---------- Backfill ----------------------------------------------------
insert into public.client_timeline_events (client_id, workspace_id, event_type, title, occurred_at)
select c.id, c.workspace_id, 'client_created', 'Cliente creado: ' || c.name, c.created_at
from public.clients c
where not exists (
  select 1 from public.client_timeline_events e
  where e.client_id = c.id and e.event_type = 'client_created'
);
