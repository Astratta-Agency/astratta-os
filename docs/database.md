# Astratta OS — Database

The schema migration lives at `docs/migrations/001_astratta_core_schema.sql`.

## How to apply

Because this project connects to **your own** Supabase project (not Lovable Cloud), Lovable can't apply migrations for you. Apply it manually one of two ways:

### Option A — Supabase SQL Editor
1. Open https://supabase.com/dashboard/project/vdnblnrwkkychxzbixam/sql/new
2. Paste the entire contents of `docs/migrations/001_astratta_core_schema.sql`
3. Run.

### Option B — Supabase CLI
```bash
supabase link --project-ref vdnblnrwkkychxzbixam
mkdir -p supabase/migrations
cp docs/migrations/001_astratta_core_schema.sql \
   supabase/migrations/$(date +%Y%m%d%H%M%S)_astratta_core_schema.sql
supabase db push
```

## After applying — generate TypeScript types

```bash
npx supabase gen types typescript \
  --project-id vdnblnrwkkychxzbixam \
  --schema public \
  > src/integrations/supabase/types.ts
```

Then the typed client at `src/integrations/supabase/client.ts` will use them automatically (it imports `Database` from `./types`).

## Verification
After applying, run the smoke tests in `docs/security-tests.sql` and check:
- Every table has RLS enabled (Supabase Dashboard → Authentication → Policies).
- Creating a workspace auto-creates a `workspace_members` row with `role='owner'`.
- A second user cannot SELECT another workspace's clients.

## Migration history
- `001_astratta_core_schema.sql` — core tables (workspaces, clients, projects, ...).
- `009_media_assets_and_buckets.sql` — media_assets + Storage buckets.
- `011_notifications.sql` — notifications + fan-out triggers.
- `013_timeline_project_updated.sql` — project field-change timeline entries.
- `014_finance_module.sql` — **invoices**, **invoice_items**, **payments** + `clients.stripe_customer_id` + `workspaces.default_tax_rate` / `default_payment_terms_days` / `invoice_notes_default`. Notification types extended: `invoice_sent`, `invoice_paid`, `invoice_overdue`, `invoice_payment_failed`.
