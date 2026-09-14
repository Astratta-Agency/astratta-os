-- Enums
create type public.lead_stage as enum ('lead','diagnostico','propuesta_enviada','negociacion','ganado','perdido');
create type public.lead_source as enum ('organic','referral','meta_ads','google_ads','other');

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  source public.lead_source not null default 'organic',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  stage public.lead_stage not null default 'lead',
  estimated_value numeric(10,2),
  probability smallint not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  lost_reason text,
  notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  converted_client_id uuid references public.clients(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_workspace_idx on public.leads(workspace_id);
create index leads_stage_idx on public.leads(stage);

alter table public.leads enable row level security;
create policy "leads_select" on public.leads for select using (public.is_workspace_member(workspace_id));
create policy "leads_insert" on public.leads for insert with check (public.is_workspace_member(workspace_id));
create policy "leads_update" on public.leads for update using (public.is_workspace_member(workspace_id));
create policy "leads_delete" on public.leads for delete using (public.is_workspace_owner(workspace_id));

create trigger set_leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- Diagnostics (audit checklist attached to a lead)
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null default 'Diagnóstico / Auditoría',
  sections jsonb not null default '[]'::jsonb,
  overall_notes text,
  is_completed boolean not null default false,
  pdf_generated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diagnostics_lead_idx on public.diagnostics(lead_id);

alter table public.diagnostics enable row level security;
create policy "diagnostics_select" on public.diagnostics for select using (public.is_workspace_member(workspace_id));
create policy "diagnostics_insert" on public.diagnostics for insert with check (public.is_workspace_member(workspace_id));
create policy "diagnostics_update" on public.diagnostics for update using (public.is_workspace_member(workspace_id));
create policy "diagnostics_delete" on public.diagnostics for delete using (public.is_workspace_owner(workspace_id));

create trigger set_diagnostics_updated_at before update on public.diagnostics
  for each row execute function public.set_updated_at();

-- Generic in-app notification fanout, honoring per-user notification_preferences (default: enabled)
create or replace function public.notify_workspace_members(
  p_workspace_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_link text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.status = 'active'
  loop
    if coalesce(
      (select np.in_app_enabled from public.notification_preferences np
       where np.workspace_id = p_workspace_id and np.user_id = r.user_id and np.event_type = p_event_type),
      true
    ) then
      insert into public.notifications (workspace_id, recipient_user_id, type, title, body, link, metadata)
      values (p_workspace_id, r.user_id, p_event_type, p_title, p_body, p_link, p_metadata);
    end if;
  end loop;
end;
$$;

create or replace function public.trg_notify_new_lead() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_workspace_members(
    NEW.workspace_id,
    'new_lead',
    'Nuevo lead: ' || NEW.company_name,
    coalesce(NEW.contact_name, '') || ' · ' || coalesce(NEW.contact_email, ''),
    '/app/ventas?lead=' || NEW.id::text
  );
  return NEW;
end;
$$;

create trigger notify_new_lead after insert on public.leads
  for each row execute function public.trg_notify_new_lead();
