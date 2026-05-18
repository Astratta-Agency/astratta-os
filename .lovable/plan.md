# Phase 4.4 — Real-time agency notifications + Submit-for-approval flow

End-to-end loop that lets agency send posts to client for approval, fires a Postgres trigger when client responds, and surfaces results to the agency in real time via a notifications bell. Also unblocks two parked Edge Function bugs by fixing the auth pattern.

## 1. Migration — `docs/migrations/011_notifications.sql`

New `public.notifications` table:

- Columns: `id`, `workspace_id`, `recipient_user_id`, `type` (check constraint: `post_approved`, `post_rejected`, `post_changes_requested`, `invite_accepted`, `payment_received`, `contract_expiring`), `title`, `body`, `link`, `read`, `read_at`, `metadata jsonb`, `created_at`.
- Partial index on `(recipient_user_id, created_at desc) where read = false`.
- RLS enabled. Policies: select + update only when `recipient_user_id = auth.uid()`.

Trigger `notify_post_status_change()` on `social_posts` AFTER UPDATE OF status:

- Skips if status unchanged or not in `(approved, rejected, changes_requested)`.
- Looks up client → workspace, fans out one notification per active `workspace_members` row with role `owner` or `team_member`.
- Title is client-driven (e.g. `"<Client> aprobó un post"`), body is the truncated caption, link is `/app/calendario?post=<id>`, metadata includes `post_id`, `client_id`, `new_status`, `rejection_reason`.

**Server-side approval lock guard** — also add a separate trigger `BEFORE UPDATE OF status` on `social_posts` that:

- If `OLD.status = 'pending_approval'` AND `NEW.status IN ('approved','rejected','changes_requested')`:
  - Checks if any other update has already landed in the last 2 seconds for this post (lookup `content_approval_history` rows with `post_id = OLD.id AND action IN ('approved','rejected','changes_requested') AND created_at > now() - interval '2 seconds'`).
  - If yes: `RAISE EXCEPTION 'Already responded to this post in the last 2 seconds'`.
  - Prevents double-submit when 2 client_admins click simultaneously from different devices.

(Per project convention: schema-only migration file. User applies it manually in the Supabase SQL editor.)

## 2. Client-side submit-for-approval flow

For the agency editor to trigger the loop, we need a clean submit action with real pre-flight validation (not just "is there a channel"):

- `src/lib/preflight-approval.ts` — `runApprovalPreflight(post, variants, mediaAssets, clientUsers)` → returns `{ ok: true } | { ok: false, errors: string[], actions?: Array<{label, path}> }`. Checks in order:
  1. At least 1 channel in `post.channels[]` — error "Debes activar al menos un canal antes de enviar a aprobación"
  2. Each enabled channel has a `post_variants` row with `caption.trim().length > 0` — error per channel: "Falta el caption para {channelName}"
  3. `post.scheduled_for` is set AND > `now()` — error "Define una fecha de publicación futura antes de enviar"
  4. If `isHealthcareClient(client)` AND `post.media_urls.length > 0`: every referenced asset has `consent_signed = true` (lookup via `useAssetsByUrls`). Error lists asset filenames missing consent + action "Ver biblioteca" → `/portal-or-vault link`
  5. Client has at least 1 `client_users` row with role `client_admin` AND status in `('active','invited')`. Error: "Este cliente no tiene admin invitado al portal. Invita uno desde Stakeholders." + action → `/app/clientes/{slug}#stakeholders`
- `src/hooks/usePostSubmitForApproval.ts` — mutation that:
  1. Runs `runApprovalPreflight`; throws preflight errors if any
  2. Calls Edge Function `send-content-approval-request` with body `{ post_id, source: 'manual', message: optionalNote }`
  3. The Edge Function does the status transition `draft|changes_requested → pending_approval` server-side (NOT client-side, to ensure atomic with the email send)
  4. Parses response `{ emailed, sent, failed, portalUrl, recipientEmails }`
  5. Invalidates `social-posts`, `social-post-detail`, `content-approval-history` queries
  6. Returns the full response object so UI can show success state or fallback
- `src/components/calendar/editor/submit-for-approval-dialog.tsx` — Two-step:
  - **Step 1 (Pre-flight check)**: runs `runApprovalPreflight` on dialog open. If preflight has errors, shows them with action buttons to resolve (e.g. "Ir a Stakeholders" navigates closing the dialog). Submit button disabled until all green.
  - **Step 2 (Confirmation)**: shows summary "Se enviará a {N} admin(s) del cliente: {emails}" + optional `message` textarea (max 300 chars) included in the email body + "Enviar a cliente" CTA.
- `src/components/calendar/editor/submit-success-state.tsx` — Post-submit:
  - If `response.emailed === true`: green check + "Enviado a {N} admin(s)" + "El correo puede tardar 1-2 minutos en llegar" + Cerrar
  - If `response.emailed === false` (Edge Function failed but post status was updated): orange info + read-only `portalUrl` input + "Copiar enlace" + "Copiar mensaje completo" (pre-formatted message ready to paste in WhatsApp/email):

```
    Hola {clientName},
    
    Tienes un nuevo post pendiente de aprobación en el portal:
    
    {portalUrl}
    
    {optionalMessage}
    
    — {workspaceName}
```

- `src/components/calendar/editor/post-submit-for-approval-button.tsx` — primary CTA mounted prominently in `PostEditorPanel` header (left of `StateChangeDropdown`), only visible when status is `draft` / `pending_internal_review` / `changes_requested`. Label adapts:
  - `draft` or `pending_internal_review` → "Enviar a cliente"
  - `changes_requested` → "Reenviar a cliente"
  - Style: secondary brand color background (`#ff7503`), white text, Send icon, prominent right side.

Edit `src/components/calendar/editor/post-editor-panel.tsx` to mount the button.

## 3. Real-time notifications hooks + UI

- `src/hooks/useNotifications.ts`
  - `useNotifications()` — fetches unread + last 20 for current user, subscribes to `notifications` INSERT via `supabase.channel` filtered by `recipient_user_id`, invalidates query on event.
  - `useMarkNotificationRead(id)` and `useMarkAllRead()` mutations.
- `src/hooks/usePostStatusChanges.ts` — ambient subscription mounted in `AppShell` that listens to `social_posts` UPDATE filtered by active workspace and invalidates `useSocialPosts` cache. (Trigger handles notification insert server-side; this just ensures calendar refreshes everywhere, not only on the page that already subscribes.)
- `src/components/notifications-bell.tsx` — replaces the placeholder bell in `top-bar.tsx`:
  - Unread badge count (hidden when 0).
  - Dropdown with last 20 (icon by type, title, body, relative time via `date-fns` locale `es`).
  - Click row → navigates to `link` + marks read.
  - Footer: "Marcar todas como leídas" + disabled "Ver todas" (full page deferred).
  - Mobile: dropdown becomes a Sheet drawer for better touch targets.
- Edit `src/components/top-bar.tsx` — swap the placeholder `<Button><Bell/></Button>` for `<NotificationsBell />`.

## 4. Edge Function fixes (un-blocks parked bugs)

- `supabase/functions/send-content-approval-request/index.ts` — three changes:
  1. Auth pattern: extract `Authorization` header, instantiate request-scoped Supabase client with `{ global: { headers: { Authorization: authHeader } } }`, call `client.auth.getUser()`. Return 401 with clear error message if missing/invalid.
  2. Move the **post status transition** (`draft → pending_approval`) INSIDE the function, after auth + workspace check, so that "send email failed" doesn't leave the post in a half-updated state. Use a service-role client for the write.
  3. Use Zod for body validation: `{ post_id: uuid, source: 'manual' | 'trigger', message?: string (max 300) }`. Validate before any side effects.
- `supabase/functions/send-portal-invite/index.ts` — same auth pattern fix. Un-blocks the parked bug.
- `supabase/functions/ping/index.ts` — new 10-line health-check returning `{ ok: true, ts, user_id: <if auth header present else null> }`. Useful for debugging the Test panel.

(Deploy steps for these are manual after merge since this is BYO Supabase.)

## 5. Verification

- After merge + manual deploy + migration apply:
  1. **Auth pattern fix sanity** — invoke `ping` from Supabase Test panel with fresh JWT → must return `{ ok: true, user_id: <your uuid> }`. If yes, both other functions are fixed too.
  2. **Submit flow** — open a draft post in calendar editor → click "Enviar a cliente" → confirm preflight passes → confirm dialog → invoke → email arrives + status moves to `pending_approval`.
  3. **Trigger test (server-side)** — manually UPDATE a `social_posts.status` to `approved` via SQL editor → confirm a notification row appears for every active workspace member.
  4. **Bell UI** — open dropdown after step 3 → unread count, click-to-navigate, mark-all-read all work.
  5. **End-to-end** — agency submits → client logs into portal → approves → agency sees realtime notification + calendar updates color → no page reload.

## Out of scope (deferred)

- Edge Function that emails the agency on approval result (in-app only for now).
- Daily email digest.
- Slack / WhatsApp / mobile push.
- `/app/notificaciones` full-page list.
- Email rate limiting / quotas.
- Notification preferences per user (mute certain types).

## Files

**Created**

- `docs/migrations/011_notifications.sql`
- `supabase/functions/ping/index.ts`
- `src/lib/preflight-approval.ts`
- `src/hooks/usePostSubmitForApproval.ts`
- `src/hooks/usePostStatusChanges.ts`
- `src/hooks/useNotifications.ts`
- `src/components/calendar/editor/post-submit-for-approval-button.tsx`
- `src/components/calendar/editor/submit-for-approval-dialog.tsx`
- `src/components/calendar/editor/submit-success-state.tsx`
- `src/components/notifications-bell.tsx`

**Edited**

- `supabase/functions/send-content-approval-request/index.ts` (auth pattern + status transition moved server-side + Zod)
- `supabase/functions/send-portal-invite/index.ts` (auth pattern fix)
- `src/components/calendar/editor/post-editor-panel.tsx` (mount Submit button + dialog)
- `src/components/top-bar.tsx` (wire NotificationsBell)
- `src/layouts/AppShell.tsx` (mount ambient usePostStatusChanges subscription)

## Manual steps after merge

1. Apply `docs/migrations/011_notifications.sql` in Supabase SQL editor.
2. Deploy `send-content-approval-request`, `send-portal-invite`, and new `ping` Edge Functions (Supabase CLI or web editor).
3. From the Test panel, invoke `ping` with a fresh JWT — should return `{ ok: true, user_id }` not 401. This confirms the auth pattern fix worked.
4. Then invoke `send-content-approval-request` with a real post_id — should return `{ emailed: true|false }`.