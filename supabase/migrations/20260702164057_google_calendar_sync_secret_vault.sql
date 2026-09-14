-- REDACTADO AL VERSIONAR (2026-08-08)
--
-- La migración aplicada en producción incrustaba el valor literal del secreto
-- como primer argumento de vault.create_secret(). No se reproduce aquí: meter
-- un secreto vivo en el repositorio lo deja en el historial de git para
-- siempre, incluso si se borra después.
--
-- Para levantar un entorno nuevo, genera un secreto propio y aplícalo a mano:
--
--   select vault.create_secret(
--     gen_random_uuid()::text,
--     'google_calendar_sync_secret',
--     'Shared secret sent as X-Sync-Secret header when pg_cron invokes google-calendar-sync-cycle edge function'
--   );
--
-- El mismo valor debe quedar configurado como SYNC_CRON_SECRET en los secretos
-- de Edge Functions, porque google-calendar-sync-cycle lo compara contra la
-- cabecera X-Sync-Secret entrante.
--
-- El secreto que se usó en producción sigue activo y debería rotarse.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'google_calendar_sync_secret') then
    raise notice 'google_calendar_sync_secret no existe — créalo manualmente (ver comentario arriba)';
  end if;
end $$;
