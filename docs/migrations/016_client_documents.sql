-- 016_client_documents.sql
-- General-purpose client document uploads (briefs, kickoffs, brand guidelines, other).
-- Reuses the existing "client-media" Storage bucket (see docs/setup-storage.md) under
-- a `.../documents/` subfolder — no new bucket or MIME types required.
-- Apply manually via Supabase SQL editor (see docs/database.md).

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  title text not null,
  category text not null default 'other'
    check (category in ('brief', 'kickoff', 'brand_guidelines', 'other')),
  storage_path text not null unique,
  public_url text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_documents_client_created
  on public.client_documents (client_id, created_at desc);

alter table public.client_documents enable row level security;

drop policy if exists client_documents_select on public.client_documents;
create policy client_documents_select on public.client_documents
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or public.is_client_user(client_id)
  );

-- Only the agency (workspace members) can upload/edit/delete. Clients are read-only.
drop policy if exists client_documents_write on public.client_documents;
create policy client_documents_write on public.client_documents
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
