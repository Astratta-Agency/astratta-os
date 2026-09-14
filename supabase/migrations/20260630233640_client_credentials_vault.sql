-- =========================================================================
-- Bóveda de credenciales de cliente — respaldada por Supabase Vault
-- =========================================================================

-- 1. Categorías de credencial (sección 12.3 del doc de visión)
create type public.credential_category as enum ('social_media','analytics','hosting_domain_cms','tool_other');

-- 2. Metadata table — el valor real NUNCA se guarda aquí, solo la referencia
--    al secreto cifrado en vault.secrets.
create table public.client_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  category public.credential_category not null default 'tool_other',
  username text,
  login_url text,
  notes text,
  vault_secret_id uuid not null references vault.secrets(id) on delete restrict,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_client_credentials_client_id on public.client_credentials(client_id);
create index idx_client_credentials_workspace_id on public.client_credentials(workspace_id);
create index idx_client_credentials_created_by on public.client_credentials(created_by);

alter table public.client_credentials enable row level security;

-- Cualquier miembro activo del workspace ve los metadatos (etiqueta, categoría,
-- usuario, URL) — NUNCA el secreto, que solo sale por la función reveal_*.
create policy client_credentials_select on public.client_credentials
  for select to authenticated
  using (is_workspace_member(workspace_id));

-- Solo owner/team_member pueden editar metadata directamente. Restringido a
-- nivel de columna: vault_secret_id NUNCA es actualizable desde el cliente
-- (evita que alguien repunte una credencial hacia el secreto de otro).
create policy client_credentials_update on public.client_credentials
  for update to authenticated
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy client_credentials_delete on public.client_credentials
  for delete to authenticated
  using (can_write_workspace(workspace_id));

revoke all on public.client_credentials from authenticated, anon;
grant select, delete on public.client_credentials to authenticated;
grant update (label, category, username, login_url, notes, updated_at) on public.client_credentials to authenticated;
-- Sin INSERT directo: toda creación pasa por create_client_credential()
-- porque necesita generar el vault_secret_id de forma controlada.

-- 3. Audit log — "quién accedió y cuándo" (sección 12.3)
create table public.client_credential_access_log (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.client_credentials(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  accessed_at timestamptz not null default now()
);

create index idx_credential_access_log_credential on public.client_credential_access_log(credential_id);
create index idx_credential_access_log_workspace on public.client_credential_access_log(workspace_id);
create index idx_credential_access_log_actor on public.client_credential_access_log(actor_id);

alter table public.client_credential_access_log enable row level security;

create policy credential_access_log_select on public.client_credential_access_log
  for select to authenticated
  using (is_workspace_member(workspace_id));

revoke all on public.client_credential_access_log from authenticated, anon;
grant select on public.client_credential_access_log to authenticated;
-- Sin INSERT directo: solo reveal_client_credential() escribe aquí.

-- 4. Limpieza del secreto en vault al borrar una credencial
create or replace function public.tl_on_client_credential_delete()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$$;

create trigger trg_client_credential_delete
  before delete on public.client_credentials
  for each row execute function public.tl_on_client_credential_delete();

-- 5. Crear credencial (genera el secreto en vault de forma controlada)
create or replace function public.create_client_credential(
  _client_id uuid,
  _label text,
  _category public.credential_category,
  _secret text,
  _username text default null,
  _login_url text default null,
  _notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_secret_id uuid;
  v_credential_id uuid;
begin
  select workspace_id into v_workspace_id from public.clients where id = _client_id;
  if v_workspace_id is null then
    raise exception 'Cliente no encontrado';
  end if;
  if not can_write_workspace(v_workspace_id) then
    raise exception 'No tienes permiso para crear credenciales en este workspace';
  end if;
  if _secret is null or length(_secret) = 0 then
    raise exception 'El valor de la credencial no puede estar vacío';
  end if;
  if _label is null or length(trim(_label)) = 0 then
    raise exception 'La etiqueta es requerida';
  end if;

  v_secret_id := vault.create_secret(_secret, _label, 'client_credential:' || _client_id::text);

  insert into public.client_credentials (
    workspace_id, client_id, label, category, username, login_url, notes, vault_secret_id, created_by
  ) values (
    v_workspace_id, _client_id, trim(_label), _category, _username, _login_url, _notes, v_secret_id, auth.uid()
  ) returning id into v_credential_id;

  return v_credential_id;
end;
$$;

-- 6. Actualizar el valor del secreto (no toca metadata)
create or replace function public.update_client_credential_secret(
  _credential_id uuid,
  _secret text
) returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_vault_id uuid;
begin
  select workspace_id, vault_secret_id into v_workspace_id, v_vault_id
  from public.client_credentials where id = _credential_id;
  if v_workspace_id is null then
    raise exception 'Credencial no encontrada';
  end if;
  if not can_write_workspace(v_workspace_id) then
    raise exception 'No tienes permiso para editar esta credencial';
  end if;
  if _secret is null or length(_secret) = 0 then
    raise exception 'El valor de la credencial no puede estar vacío';
  end if;

  perform vault.update_secret(v_vault_id, _secret);

  update public.client_credentials set updated_at = now() where id = _credential_id;
end;
$$;

-- 7. Revelar el secreto (autoriza, descifra, audita)
create or replace function public.reveal_client_credential(_credential_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_vault_id uuid;
  v_secret text;
begin
  select workspace_id, vault_secret_id into v_workspace_id, v_vault_id
  from public.client_credentials where id = _credential_id;
  if v_workspace_id is null then
    raise exception 'Credencial no encontrada';
  end if;
  if not can_write_workspace(v_workspace_id) then
    raise exception 'No tienes permiso para revelar esta credencial';
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_vault_id;

  insert into public.client_credential_access_log (credential_id, workspace_id, actor_id)
  values (_credential_id, v_workspace_id, auth.uid());

  return v_secret;
end;
$$;

-- 8. Grants de EXECUTE — explícitos por rol (PUBLIC no alcanza en este proyecto)
revoke execute on function public.tl_on_client_credential_delete() from anon, authenticated, public;

revoke execute on function public.create_client_credential(uuid, text, public.credential_category, text, text, text, text) from anon, authenticated, public;
grant execute on function public.create_client_credential(uuid, text, public.credential_category, text, text, text, text) to authenticated;

revoke execute on function public.update_client_credential_secret(uuid, text) from anon, authenticated, public;
grant execute on function public.update_client_credential_secret(uuid, text) to authenticated;

revoke execute on function public.reveal_client_credential(uuid) from anon, authenticated, public;
grant execute on function public.reveal_client_credential(uuid) to authenticated;
