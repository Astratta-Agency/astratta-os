create type public.proposal_type as enum ('web','social','ads','branding','bundle');
create type public.proposal_status as enum ('draft','sent','viewed','negotiation','signed','rejected','expired');

create table public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type public.proposal_type not null,
  content jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.proposal_templates enable row level security;
create policy "proposal_templates_select" on public.proposal_templates for select using (public.is_workspace_member(workspace_id));
create policy "proposal_templates_all" on public.proposal_templates for all
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null,
  type public.proposal_type not null,
  status public.proposal_status not null default 'draft',
  currency text not null default 'usd',
  total_amount numeric(10,2) not null default 0,
  valid_until date,
  content jsonb not null default '[]'::jsonb,
  public_token uuid not null default gen_random_uuid(),
  version integer not null default 1,
  parent_proposal_id uuid references public.proposals(id) on delete set null,
  created_by uuid,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (public_token)
);
create index proposals_workspace_idx on public.proposals(workspace_id);
create index proposals_lead_idx on public.proposals(lead_id);

alter table public.proposals enable row level security;
create policy "proposals_select" on public.proposals for select using (public.is_workspace_member(workspace_id));
create policy "proposals_insert" on public.proposals for insert with check (public.is_workspace_member(workspace_id));
create policy "proposals_update" on public.proposals for update using (public.is_workspace_member(workspace_id));
create policy "proposals_delete" on public.proposals for delete using (public.is_workspace_owner(workspace_id));

create trigger set_proposals_updated_at before update on public.proposals
  for each row execute function public.set_updated_at();

-- View/open tracking events (inserted only by the public get-proposal edge function via service role)
create table public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  event_type text not null,
  ip_address text,
  user_agent text,
  occurred_at timestamptz not null default now()
);
alter table public.proposal_events enable row level security;
create policy "proposal_events_select" on public.proposal_events for select using (
  exists (select 1 from public.proposals p where p.id = proposal_id and public.is_workspace_member(p.workspace_id))
);

-- Native e-signature with audit trail (inserted only by the public sign-proposal edge function via service role)
create table public.proposal_signatures (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  signer_name text not null,
  signer_email text,
  signature_data_url text not null,
  consent_text text not null,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now()
);
alter table public.proposal_signatures enable row level security;
create policy "proposal_signatures_select" on public.proposal_signatures for select using (
  exists (select 1 from public.proposals p where p.id = proposal_id and public.is_workspace_member(p.workspace_id))
);

create or replace function public.trg_notify_proposal_signed() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (OLD.status is distinct from 'signed' and NEW.status = 'signed') then
    perform public.notify_workspace_members(
      NEW.workspace_id,
      'proposal_signed',
      'Propuesta firmada: ' || NEW.title,
      'La propuesta fue firmada por el cliente.',
      '/app/ventas?proposal=' || NEW.id::text
    );
  end if;
  return NEW;
end;
$$;

create trigger notify_proposal_signed after update on public.proposals
  for each row execute function public.trg_notify_proposal_signed();
