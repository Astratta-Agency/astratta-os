-- The trigger was firing BEFORE DELETE and trying to delete the linked
-- vault.secrets row while the client_credentials row (which FKs to it)
-- still existed, causing:
--   "update or delete on table "secrets" violates foreign key constraint
--    "client_credentials_vault_secret_id_fkey" on table "client_credentials""
-- Moving it to AFTER DELETE so the credential row is gone by the time we
-- clean up its vault secret.

drop trigger if exists trg_client_credential_delete on public.client_credentials;

create trigger trg_client_credential_delete
after delete on public.client_credentials
for each row execute function public.tl_on_client_credential_delete();
