-- Open the client credentials vault (metadata only) to the client portal, and let a client's own
-- client_admin reveal the real secret. Client_viewer can see the row (masked in the UI) but the
-- reveal RPC still rejects them.

create policy client_credentials_client_select
  on public.client_credentials
  for select
  using (public.is_client_user(client_id));

create or replace function public.reveal_client_credential(_credential_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'vault', 'pg_temp'
as $function$
declare
  v_workspace_id uuid;
  v_client_id uuid;
  v_vault_id uuid;
  v_secret text;
begin
  select workspace_id, client_id, vault_secret_id into v_workspace_id, v_client_id, v_vault_id
  from public.client_credentials where id = _credential_id;
  if v_workspace_id is null then
    raise exception 'Credencial no encontrada';
  end if;
  if not (can_write_workspace(v_workspace_id) or is_client_admin(v_client_id)) then
    raise exception 'No tienes permiso para revelar esta credencial';
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_vault_id;

  insert into public.client_credential_access_log (credential_id, workspace_id, actor_id)
  values (_credential_id, v_workspace_id, auth.uid());

  return v_secret;
end;
$function$;
