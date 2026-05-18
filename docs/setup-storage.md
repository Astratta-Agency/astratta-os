# Storage bucket setup — `client-media`

The `media_assets` table (migration 009) needs a Supabase Storage bucket called
`client-media`. Some Supabase plans reject `insert into storage.buckets` from
SQL, so create the bucket in the Dashboard.

## 1. Create the bucket

Dashboard → Storage → **New bucket**
- Name: `client-media`
- Public bucket: **Yes** (read access through public URLs)
- File size limit: `50 MB`
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `video/mp4`
  - `video/quicktime`
  - `application/pdf` (for consent forms uploaded under `/consents/`)

## 2. RLS policies on `storage.objects`

The first folder segment of every object path is the `workspace_id`. RLS uses
that segment to scope access to workspace members.

Run in the SQL editor:

```sql
-- SELECT (anyone authenticated can read; bucket is public anyway)
drop policy if exists client_media_select on storage.objects;
create policy client_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'client-media');

-- INSERT — only workspace members of the workspace_id in the first folder
drop policy if exists client_media_insert on storage.objects;
create policy client_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );

-- DELETE — same constraint
drop policy if exists client_media_delete on storage.objects;
create policy client_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );

-- UPDATE — same constraint (metadata edits)
drop policy if exists client_media_update on storage.objects;
create policy client_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );
```

## 3. Path convention

- Media: `{workspace_id}/{client_id}/{uuid}-{sanitized_filename}.{ext}`
- Consent forms: `{workspace_id}/{client_id}/consents/{uuid}-{patient_ref}.pdf`

This makes per-workspace cleanup trivial: deleting all objects under
`{workspace_id}/` removes everything that client's workspace ever uploaded.
