## Phase 4.2 — Full Multi-Channel Post Editor

Replace the read-only `post-detail-panel.tsx` with a full editing experience: per-channel variants, char counters per platform, hashtags, mentions, first comment (IG), UTM builder, live preview, format selector. Asset uploads remain deferred to 4.3.

### Database

`docs/migrations/008_post_variants.sql` (user applies in SQL editor):

- `post_variants` table: `(id, post_id FK→social_posts, channel, caption, hashtags, first_comment, mentions text[], location, utm_url, is_enabled, updated_at, updated_by)`, unique on `(post_id, channel)`, index on `post_id`.
- **Additional indexes**: `idx_post_variants_mentions_gin on post_variants using gin (mentions)` (for future mention-based queries — costs 0 to add now).
- RLS: workspace members get full access via `social_posts → clients → workspace`. Client users get SELECT only for posts in `pending_approval|approved|rejected|scheduled|published`.
- Trigger `set_post_variants_updated_at` updates `updated_at` + `updated_by = auth.uid()`.
- Expand `social_posts.type` check to `('feed_post','carousel','reel','story','video','other')`.
- **Add column** `social_posts.format_meta jsonb default '{}'::jsonb` for format-specific metadata (story duration, reel cover frame index, carousel order map, etc.). UI to manipulate this lives in 4.3, but adding the column now avoids a future migration.

### Code

**Channel meta —** `src/lib/channels.ts`

`CHANNEL_META` with `{ label, limit, hashtagLimit, firstComment, icon, color }` per channel (IG 2200, FB 63206, LI 3000, TT 2200, X 280, Threads 500). IG is the only one with `firstComment: true`.

**Hooks — `src/hooks/usePostEditor.ts**`

- `usePost(postId)` — joins `social_posts` + `post_variants[]`. enabled: `!!postId`.
- `useUpdatePost(postId)` — patches the post row.
- `useUpsertVariant(postId)` — upserts by `(post_id, channel)`.
- `useDeleteVariant(postId, channel)` — sets `is_enabled=false`.
- `useAutosave(saveFn)` — 1.5s debounce, exposes `{ status: 'idle'|'saving'|'saved'|'error', lastSavedAt }`.
- `useDirtyState(postId)` — tracks whether the in-memory editor state has unsaved diffs vs the last saved snapshot. Used by `Esc` close confirm and by the browser `beforeunload` guard (only mounted when editor is open).

**Components — `src/components/calendar/editor/**`

- `post-editor-panel.tsx` — Sheet 920px (full-screen on mobile). Header with editable title, state badge, autosave indicator, action bar (state dropdown, duplicar, eliminar). 2-col body (editor left, preview right; stacked on mobile with collapsible preview).
  - **Anti-data-loss guardrails**:
    - `Esc` close shows confirm dialog ONLY if `useDirtyState` returns dirty AND autosave status is `error` or `saving` (not saved yet). If saved, close silently.
    - Mount a `useBeforeUnload` handler that triggers the native browser "Are you sure you want to leave?" if dirty AND not saved.

- `post-editor-meta.tsx` — cliente (read-only), pilar, formato (segmented), fecha programada (date+time), estado.

- `post-format-warnings.tsx` — contextual hints for story / reel / carousel.

- `channel-tabs.tsx` — one tab per enabled channel with icon + char counter pill (amber at 80%, red at 100%). "+ Agregar canal" dropdown for missing channels. Remove with confirm. **Keyboard shortcut**: `Cmd/Ctrl + 1..6` jumps to channel tab N (no input focused). Acelera el switching entre canales cuando estás editando 4 variantes seguidas.

- `variant-editor.tsx` — caption Textarea (auto-resize + live count), hashtags field (count vs `hashtagLimit`), first comment (IG only), mentions (text array for now), location, UTM URL display + builder button, "Copiar variante a otros canales" modal (copies caption/hashtags/mentions/location, not first_comment or utm_url).

- `utm-builder-dialog.tsx` — prefilled `source=channel`, `medium=social`, `campaign=${client.slug}-${yyyy-MM}`, `content=post.id[-8:]`. Base URL field with validation, live preview, "Copiar" + "Aplicar".

- `post-preview.tsx` — channel-specific mock (IG square 380px, FB 380px, LI 500px, X 500px compact, TT 380px vertical, Threads 500px). Mini header + media or placeholder + caption (truncate at "..." per channel) + hashtags + first comment + action row icons. Auto-switches with active tab.

- `media-urls-editor.tsx` — URL paste input + "Agregar URL" → horizontal thumbs with remove X. Basic ordering for carousel (full drag in 4.3).

- `state-change-dropdown.tsx` — uses `POST_STATE_TRANSITIONS`. Destructive states confirm. `pending_approval` shows toast about deferred email wire-up.

### Wiring

- `src/components/calendar/post-card.tsx` — click handler opens `PostEditorPanel` instead of detail panel.
- `src/pages/app/Calendario.tsx` — mount `PostEditorPanel`; sync `?post={id}` URL param (open on load if id is in workspace, remove on close). When closing with dirty state, prompt confirm; on cancel, keep editor open with param intact.
- `src/components/calendar/post-detail-panel.tsx` — removed from render tree; file kept (deprecated stub) until 4.3 cleanup.

### UX

- Autosave 1.5s after last keystroke. Indicator: "Guardando..." → "Guardado · hace Xs". On error: toast with "Reintentar".
- Cmd/Ctrl+S = immediate save. Esc closes (confirm if pending dirty).
- Char counter visible while scrolling variant editor (sticky on active tab).

### URL behavior

- `/app/calendario?post={id}` auto-opens editor.
- Closing removes param (back-button friendly).
- Shareable inside the team.

### Out of scope (deferred)

- Asset uploads to Storage (4.3) — only URL paste now.
- Full carousel drag-reorder (4.3).
- AI captions, hashtag/mention autocomplete (later).
- Approval email Edge Function wire-up (4.4).
- Real publishing to Meta/TikTok APIs (Phase 5).
- UI to edit `format_meta` (column exists, UI in 4.3).

### Files

**Created**: `docs/migrations/008_post_variants.sql`, `src/lib/channels.ts`, `src/hooks/usePostEditor.ts`, and 8 components under `src/components/calendar/editor/`.

**Edited**: `src/components/calendar/post-card.tsx`, `src/pages/app/Calendario.tsx`, `src/components/calendar/post-detail-panel.tsx`.