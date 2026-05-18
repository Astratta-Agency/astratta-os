-- Phase 4.3 — Media assets + storage
-- Apply via Supabase SQL editor. The storage bucket itself must be created
-- manually in the Dashboard — see docs/setup-storage.md.

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_name text not null,
  storage_path text not null unique,
  public_url text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width int,
  height int,
  duration_seconds numeric,
  tags text[] not null default '{}',
  orientation text generated always as (
    case
      when width is null or height is null then null
      when width > height then 'landscape'
      when width < height then 'portrait'
      else 'square'
    end
  ) stored,
  -- Healthcare / med-spa fields (only relevant for some clients)
  consent_required boolean not null default false,
  consent_signed boolean not null default false,
  consent_form_url text,
  patient_ref text,
  treatment text,
  before_after_pair_id uuid references public.media_assets(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_media_assets_client_created
  on public.media_assets (client_id, created_at desc);

create index if not exists idx_media_assets_tags_gin
  on public.media_assets using gin (tags);

create index if not exists idx_media_assets_pending_consent
  on public.media_assets (client_id)
  where consent_required = true and consent_signed = false;

alter table public.media_assets enable row level security;

drop policy if exists media_assets_select on public.media_assets;
create policy media_assets_select on public.media_assets
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or public.is_client_user(client_id)
  );

drop policy if exists media_assets_write on public.media_assets;
create policy media_assets_write on public.media_assets
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
