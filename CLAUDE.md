# Astratta OS

## Database migrations

- New migrations go in `supabase/migrations/`. `docs/migrations/` is historical; never edit or run it.
- Every `create table public.<name>` must include, in the same migration, `enable row level security`, its policies, **and explicit grants**. Since 2026-10-30 Supabase no longer grants Data API access to new tables automatically, so a table without grants returns `permission denied` to the app and edge functions.
- Grant only what each role needs (`authenticated`, `service_role`; `anon` only for genuinely public data). See "Writing a new migration" in `docs/database.md`.
