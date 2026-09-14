-- Client Reports module: monthly reports the agency prepares per client, visible in the client portal once published.

create type public.client_report_status as enum ('draft', 'published');

create table public.client_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  period_month int not null check (period_month between 1 and 12),
  period_year int not null check (period_year between 2020 and 2100),
  status public.client_report_status not null default 'draft',
  executive_summary text,
  kpis jsonb not null default '[]'::jsonb,
  top_posts jsonb not null default '[]'::jsonb,
  learnings text,
  next_month_plan text,
  recommendations text,
  pdf_storage_path text,
  pdf_public_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period_year, period_month)
);

create index client_reports_workspace_id_idx on public.client_reports(workspace_id);
create index client_reports_client_id_idx on public.client_reports(client_id);
create index client_reports_status_idx on public.client_reports(status);

create trigger client_reports_set_updated_at
  before update on public.client_reports
  for each row
  execute function public.set_updated_at();

alter table public.client_reports enable row level security;

-- Agency team (any workspace member) can see and manage all reports for their workspace.
create policy client_reports_workspace_all
  on public.client_reports
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Client portal users can only see their own client's reports once published.
create policy client_reports_client_select
  on public.client_reports
  for select
  using (status = 'published' and public.is_client_user(client_id));
