-- contract_status: borrador → enviado → firmado por cliente → contrasignado → activo → vencido / renovado / cancelado
create type public.contract_status as enum (
  'draft','sent','signed_by_client','countersigned','active','expired','renewed','cancelled'
);

-- 7.1 Generador: plantillas por tipo de servicio, versionadas
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  service_type public.proposal_type not null,
  content jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  parent_template_id uuid references public.contract_templates(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index idx_contract_templates_one_active
  on public.contract_templates (workspace_id, service_type)
  where is_active = true;

create index idx_contract_templates_workspace on public.contract_templates(workspace_id);

alter table public.contract_templates enable row level security;

create policy "contract_templates_select" on public.contract_templates
  for select using (is_workspace_member(workspace_id));

create policy "contract_templates_all" on public.contract_templates
  for all using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

-- Cláusulas legales reusables (Texas-compliant)
create table public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_contract_clauses_workspace on public.contract_clauses(workspace_id);

alter table public.contract_clauses enable row level security;

create policy "contract_clauses_select" on public.contract_clauses
  for select using (is_workspace_member(workspace_id));

create policy "contract_clauses_all" on public.contract_clauses
  for all using (is_workspace_owner(workspace_id))
  with check (is_workspace_owner(workspace_id));

-- 7.2/7.3 Contrato principal
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  template_id uuid references public.contract_templates(id) on delete set null,
  title text not null,
  service_type public.proposal_type not null,
  status public.contract_status not null default 'draft',
  currency text not null default 'usd',
  total_amount numeric not null default 0,
  start_date date,
  end_date date,
  auto_renew boolean not null default false,
  content jsonb not null default '[]'::jsonb,
  public_token uuid not null default gen_random_uuid(),
  version integer not null default 1,
  parent_contract_id uuid references public.contracts(id) on delete set null,
  created_by uuid,
  sent_at timestamptz,
  client_signed_at timestamptz,
  countersigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_contracts_public_token on public.contracts(public_token);
create index idx_contracts_workspace on public.contracts(workspace_id);
create index idx_contracts_client on public.contracts(client_id);
create index idx_contracts_project on public.contracts(project_id);
create index idx_contracts_status on public.contracts(status);
create index idx_contracts_end_date on public.contracts(end_date);

alter table public.contracts enable row level security;

create policy "contracts_select" on public.contracts
  for select using (is_workspace_member(workspace_id));

create policy "contracts_insert" on public.contracts
  for insert with check (is_workspace_member(workspace_id));

create policy "contracts_update" on public.contracts
  for update using (is_workspace_member(workspace_id));

create policy "contracts_delete" on public.contracts
  for delete using (is_workspace_owner(workspace_id));

-- Audit trail de eventos públicos (viewed, etc.)
create table public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  event_type text not null,
  ip_address text,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index idx_contract_events_contract on public.contract_events(contract_id);

alter table public.contract_events enable row level security;

create policy "contract_events_select" on public.contract_events
  for select using (
    exists (select 1 from public.contracts c where c.id = contract_id and is_workspace_member(c.workspace_id))
  );

-- Firmas: cliente (vía edge function, service role) y agencia (vía RPC countersign_contract)
create table public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signer_role text not null check (signer_role in ('client','agency')),
  signer_name text not null,
  signer_email text,
  signature_data_url text not null,
  consent_text text not null,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now()
);

create index idx_contract_signatures_contract on public.contract_signatures(contract_id);

alter table public.contract_signatures enable row level security;

create policy "contract_signatures_select" on public.contract_signatures
  for select using (
    exists (select 1 from public.contracts c where c.id = contract_id and is_workspace_member(c.workspace_id))
  );

-- Log de alertas de vencimiento ya enviadas (idempotencia del cron)
create table public.contract_alerts_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  threshold_days integer not null,
  created_at timestamptz not null default now(),
  unique (contract_id, threshold_days)
);

alter table public.contract_alerts_log enable row level security;

create policy "contract_alerts_log_select" on public.contract_alerts_log
  for select using (
    exists (select 1 from public.contracts c where c.id = contract_id and is_workspace_member(c.workspace_id))
  );

-- Vínculo de tareas a contratos (para tareas de onboarding / renovación)
alter table public.tasks add column contract_id uuid references public.contracts(id) on delete set null;
create index idx_tasks_contract_id on public.tasks(contract_id);
