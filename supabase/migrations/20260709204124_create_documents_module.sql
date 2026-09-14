-- Módulo Documentos (Fase 1)
create type public.document_type as enum ('idea','script','kpi_plan','nota','otro');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default 'Sin título',
  content jsonb not null default '{}'::jsonb,
  type public.document_type not null default 'nota',
  client_id uuid references public.clients(id) on delete set null,
  post_id uuid references public.social_posts(id) on delete set null,
  period date,
  visible_in_portal boolean not null default false,
  converted_to_post_id uuid references public.social_posts(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_workspace_idx on public.documents (workspace_id);
create index documents_client_idx on public.documents (client_id);
create index documents_post_idx on public.documents (post_id);

create or replace function public.tg_documents_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger documents_updated_at
before update on public.documents
for each row execute function public.tg_documents_updated_at();

alter table public.documents enable row level security;

create policy "team members can read documents"
on public.documents for select
using (public.is_workspace_member(workspace_id));

create policy "portal clients can read shared documents"
on public.documents for select
using (visible_in_portal and client_id is not null and public.is_client_user(client_id));

create policy "team writers can insert documents"
on public.documents for insert
with check (public.can_write_workspace(workspace_id) and created_by = auth.uid());

create policy "team writers can update documents"
on public.documents for update
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

create policy "author or owner can delete documents"
on public.documents for delete
using (created_by = auth.uid() or public.is_workspace_owner(workspace_id));
