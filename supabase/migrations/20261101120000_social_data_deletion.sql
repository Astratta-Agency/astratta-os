-- Soporte para el callback de eliminación de datos de Meta (meta-data-deletion).

-- 1. Meta identifica la solicitud por el user_id de quien autorizó la app, no por
--    la Página o cuenta de IG, así que cada conexión debe guardar ese usuario.
--    Queda null en conexiones sin usuario autorizante (p. ej. System User).
alter table public.social_connections
  add column if not exists external_user_id text;

comment on column public.social_connections.external_user_id is
  'ID del usuario en la plataforma que autorizó la conexión (app-scoped en Meta). Lo usa meta-data-deletion.';

create index if not exists social_connections_external_user_idx
  on public.social_connections (platform, external_user_id)
  where external_user_id is not null;

-- 2. Limpieza de tokens en vault al borrar una conexión, también cuando el borrado
--    viene en cascada desde el cliente o el workspace.
create or replace function public.tl_on_social_connection_delete()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  delete from vault.secrets
  where id in (old.access_token_secret_id, old.refresh_token_secret_id);
  return old;
end;
$$;

revoke all on function public.tl_on_social_connection_delete() from public, anon, authenticated;

create trigger trg_social_connection_delete
  after delete on public.social_connections
  for each row execute function public.tl_on_social_connection_delete();

-- 3. Registro de solicitudes, para la página pública de estado. No guarda el
--    user_id de quien la pidió: el código de confirmación basta para consultarla.
create table public.social_data_deletion_requests (
  confirmation_code uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('meta')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.social_data_deletion_requests enable row level security;

-- Sin políticas para authenticated ni anon: solo la edge function accede, con
-- service_role, y la página pública consulta el estado a través de ella.
revoke all on public.social_data_deletion_requests from anon, authenticated;
grant select, insert, update on public.social_data_deletion_requests to service_role;
