select cron.schedule(
  'google-calendar-sync-cycle',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://vdnblnrwkkychxzbixam.supabase.co/functions/v1/google-calendar-sync-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Sync-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
