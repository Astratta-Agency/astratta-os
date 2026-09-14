-- ============================================================
-- 9.1 Cuentas conectadas (por cliente) — schema base
-- Fase 1 acordada: conectar + traer métricas, empezando por Meta (Page + Instagram Business)
-- ============================================================

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null, -- 'facebook_page' | 'instagram_business' hoy; luego 'linkedin_page' | 'tiktok_business' | 'x_account' | 'google_business_profile'
  external_account_id text not null, -- Page ID o IG Business Account ID en Meta
  display_name text,
  username text,
  avatar_url text,
  followers_count integer,
  status text not null default 'connected', -- connected | expired | revoked | error
  granted_scopes text[] not null default '{}',
  access_token_secret_id uuid, -- puntero a vault.secrets, nunca el token en texto plano
  refresh_token_secret_id uuid,
  token_expires_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, platform, external_account_id)
);

alter table public.social_connections enable row level security;

create policy social_connections_select_member
  on public.social_connections for select
  using (is_workspace_member(workspace_id));

create policy social_connections_write_writer
  on public.social_connections for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create trigger set_social_connections_updated_at
  before update on public.social_connections
  for each row execute function public.set_updated_at();

-- índice para levantar todas las cuentas conectadas de un cliente rápido
create index if not exists social_connections_client_idx on public.social_connections (client_id);
