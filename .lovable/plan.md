## Phase 4.3 — Storage uploads + media management

Replace the URL-paste flow in the post editor with real Supabase Storage uploads, persist uploaded files in a per-client `media_assets` table, and add a reusable asset library picker. Adds a med-spa consent gate that blocks scheduling/publishing posts whose media lacks signed consent.

### Database — `docs/migrations/009_media_assets_and_buckets.sql`

`media_assets` table:

- `id, workspace_id (FK workspaces), client_id (FK clients), uploaded_by (FK auth.users)`
- `file_name, storage_path (unique), public_url, mime_type, size_bytes, width, height, duration_seconds`
- `tags text[] default '{}'`
- `orientation text generated always as (case when width is null or height is null then null when width > height then 'landscape' when width < height then 'portrait' else 'square' end) stored` — auto-derived. Esencial para warnings en reel (necesita portrait) y story (también portrait) sin tener que calcular cada vez en el cliente.
- Med-spa: `consent_required bool`, `consent_signed bool`, `consent_form_url`, `patient_ref`, `treatment`, `before_after_pair_id (self-FK)`
- `created_at`
- Indexes: `(client_id, created_at desc)`, GIN on `tags`, partial index `(client_id) where consent_required = true and consent_signed = false` — fast lookup of "qué assets están pendientes de consentimiento" para badge counts.
- RLS: SELECT for workspace members + client users; ALL for workspace members only — using existing `is_workspace_member` / `is_client_user` helpers

Storage bucket `client-media` is created manually in the Dashboard — instructions in `docs/setup-storage.md` (public read, 50MB limit, allowed mime types, RLS policies on `storage.objects` keyed off the first folder segment = workspace_id).

### Code

`**src/lib/storage.ts**`

- `uploadAsset({ file, workspaceId, clientId, onProgress? })` → uploads to `client-media` at `${workspaceId}/${clientId}/${uuid}-${sanitizedName}`.
- **Cache control**: pass `{ cacheControl: '31536000', upsert: false }` so uploaded media gets 1-year browser cache. Reduces bandwidth costs cuando 180 Grados Med Spa abre el calendario varias veces al día.
- Pre-upload validation: max 50MB, mime in `{image/jpeg,png,webp,gif, video/mp4, video/quicktime}`.
- For images: read width/height via `URL.createObjectURL` + `Image()`. For videos: read `duration` and a first-frame thumbnail (canvas at `currentTime=0.1`).
- Returns `{ storagePath, publicUrl, sizeBytes, mimeType, width?, height?, durationSeconds? }` or `{ error: 'file_too_large'|'invalid_type'|'upload_failed' }`.
- `sanitizeFilename(name)` helper: replace `[^a-zA-Z0-9._-]` with `-`, collapse hyphens, trim, max 80 chars. Cuando el cliente sube `Foto fiñal de tratamiento (2).jpg` no rompe.

`**src/lib/client-validation.ts**`

- `isHealthcareClient(client)` → `industry ∈ {Med Spa, Healthcare, Wellness}`.
- `assertConsentForMediaUrls(urls, assets)` → returns list of asset filenames missing signed consent. Used by state-change guard.

`**src/hooks/useMediaAssets.ts**`

- `useMediaAssets(clientId, { search, tags })` — list query.
- `useUploadAsset()` — wraps storage upload + insert into `media_assets`; auto-sets `consent_required=true` for healthcare clients.
- `useDeleteAsset()` — remove from storage then from table; rolls back the table delete if storage delete fails.
- `useAssetsByUrls(publicUrls)` — lookup helper used by the consent guard.

`**src/components/calendar/editor/media-uploader.tsx**` (replaces `media-urls-editor.tsx`)

- Dropzone via `react-dropzone` (added to package.json): "Arrastra una imagen/video aquí, o haz clic para seleccionar".
- Collapsible "Pegar URL" accordion preserves the legacy paste flow (HEAD validate, fallback embed on CORS fail).
- Per-file progress bar (Astratta primary token).
- Failed uploads: red border + retry icon.
- Thumbnail grid (80x80). Click X to remove from post (does not delete asset).
- When `post.type === 'carousel'`: drag-to-reorder via `dnd-kit` (cap 10 items).
- "Desde biblioteca" button opens `MediaLibraryPicker`.
- On success: append `publicUrl` to `post.media_urls[]` and insert `media_assets` row.
- **Orientation warning**: if `post.type === 'reel'` OR `post.type === 'story'` AND uploaded asset is `landscape` → inline warning "Reels y Stories funcionan mejor en formato vertical (9:16). Esta imagen es horizontal." con opción de subirla igual.
- For healthcare clients: inline consent form appears after upload (`consent_signed` checkbox, `consent_form_url` upload to `/consents/` subpath, `patient_ref`, `treatment`).

`**src/components/calendar/editor/media-library-picker.tsx**`

- Dialog listing `media_assets` for current client; search by name + tag chip filters.
- Click thumb → preview modal with metadata.
- Multi-select checkboxes → "Agregar N a este post" appends `public_url` values to `post.media_urls`.
- For med-spa assets: badge "Consentimiento firmado" (green) / "Falta consentimiento" (red).
- **Tab "Pendientes de consentimiento"** in the picker header (visible only for healthcare clients): pre-filtered view of assets with `consent_required = true AND consent_signed = false`. Te permite resolver el backlog de consentimientos sin scroll de toda la biblioteca.

### Wiring

- `variant-editor.tsx` → swap `MediaUrlsEditor` for `MediaUploader` (lift media editing up if it makes more sense at the post level — media is shared across variants, not per-channel). Recommend moving the uploader into `post-editor-panel.tsx` so all variants share it, and keep per-variant only caption/hashtags/etc.
- `post-editor-panel.tsx` → mount `MediaUploader` once in the post meta area; mount `MediaLibraryPicker` dialog.
- `state-change-dropdown.tsx` → before transitioning to `scheduled` or `published`, run `assertConsentForMediaUrls`; block with toast `El asset {filename} no tiene consentimiento firmado` if any fail. Show a "Ver biblioteca" link in the toast that opens MediaLibraryPicker directly on the "Pendientes de consentimiento" tab.
- `Calendario.tsx` → no changes.

### Storage path convention

- Media: `{workspace_id}/{client_id}/{uuid}-{sanitized_filename}.{ext}`
- Consent forms: `{workspace_id}/{client_id}/consents/{uuid}-{patient_ref_or_anon}.pdf`

Allows per-workspace cleanup via folder enumeration and keeps RLS keyed on first path segment.

### UX details

- Max 10 files per upload action.
- 50MB per file; toast on rejection.
- Video thumbs: canvas snapshot at `currentTime=0.1`.
- Upload progress at bottom edge of thumb.
- **Optimistic UI**: thumb appears in the grid immediately with progress overlay, swapped for real public_url when upload completes.

### Manual steps for the user (after merge)

1. Apply `docs/migrations/009_media_assets_and_buckets.sql` in the Supabase SQL editor.
2. Create the `client-media` bucket per `docs/setup-storage.md` (public, 50MB, allowed mime list, RLS policies).

### Out of scope (4.4+)

AI alt-text, image optimization/transcoding, bulk consent upload, approval email Edge Function, before/after pair UI beyond the FK column.

### Files

**Created**

- `docs/migrations/009_media_assets_and_buckets.sql`
- `docs/setup-storage.md`
- `src/lib/storage.ts`
- `src/lib/client-validation.ts`
- `src/hooks/useMediaAssets.ts`
- `src/components/calendar/editor/media-uploader.tsx`
- `src/components/calendar/editor/media-library-picker.tsx`

**Edited**

- `src/components/calendar/editor/variant-editor.tsx` (remove media block)
- `src/components/calendar/editor/post-editor-panel.tsx` (mount uploader + picker)
- `src/components/calendar/editor/state-change-dropdown.tsx` (consent guard)
- `package.json` (add `react-dropzone`, `@dnd-kit/core`, `@dnd-kit/sortable`)

**Deleted (or left as deprecated stub)**

- `src/components/calendar/editor/media-urls-editor.tsx`