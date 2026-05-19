# Phase 5.1 — Client Portal: Shell + Home + Approvals

Goal: replace the placeholder `/portal/:slug` with a real, branded client portal so clients (180 Grados Med Spa first) can review and act on pending content. Builds on Phase 4.4 (notifications + approval submit flow). Email wire-up stays parked (Edge Function auth bug tracked separately); manual link share remains the fallback.

## 1. Database

`docs/migrations/010_post_status_changes_requested.sql` (only if not already applied):

- Add `changes_requested` to `post_status` (enum `ADD VALUE` guarded by `pg_enum` check, or extend CHECK constraint if it's a constraint).
- No new tables; reuse existing `social_posts`, `post_variants`, `content_approval_history`, `notifications`, `client_users`, `clients`.

**RLS audit — confirm these policies exist; create them in this same migration if missing**:

```sql
-- social_posts SELECT for client_users
drop policy if exists social_posts_select_client_users on public.social_posts;
create policy social_posts_select_client_users on public.social_posts
  for select to authenticated
  using (
    public.is_client_user(client_id)
    and status in ('pending_approval','approved','rejected','changes_requested','scheduled','published')
  );

-- social_posts UPDATE for client_admin only, only the columns they need
drop policy if exists social_posts_update_client_admin on public.social_posts;
create policy social_posts_update_client_admin on public.social_posts
  for update to authenticated
  using (
    public.is_client_admin(client_id)
    and status in ('pending_approval','changes_requested')
  )
  with check (
    public.is_client_admin(client_id)
    and status in ('approved','rejected','changes_requested')
  );

-- post_variants SELECT for client_users
drop policy if exists post_variants_select_client_users on public.post_variants;
create policy post_variants_select_client_users on public.post_variants
  for select to authenticated
  using (
    exists (
      select 1 from public.social_posts sp
      where sp.id = post_variants.post_id
        and public.is_client_user(sp.client_id)
        and sp.status in ('pending_approval','approved','rejected','changes_requested','scheduled','published')
    )
  );

-- content_approval_history INSERT for client_admin
drop policy if exists content_approval_history_insert_client_admin on public.content_approval_history;
create policy content_approval_history_insert_client_admin on public.content_approval_history
  for insert to authenticated
  with check (
    public.is_client_admin(client_id)
    and action in ('approved','rejected','changes_requested')
    and actor_user_id = auth.uid()
  );

-- content_approval_history SELECT for client_users
drop policy if exists content_approval_history_select_client_users on public.content_approval_history;
create policy content_approval_history_select_client_users on public.content_approval_history
  for select to authenticated
  using (public.is_client_user(client_id));
```

If `is_client_admin(client_id)` helper doesn't exist, create it:

```sql
create or replace function public.is_client_admin(_client_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from client_users
    where client_id = _client_id
      and user_id = auth.uid()
      and role = 'client_admin'
      and status in ('active','invited')
  );
$$;
```

## 2. Shared updates

- `src/lib/post-states.ts`: add `changes_requested` (label "Cambios solicitados", color `hsl(43 96% 56%)`); extend `POST_STATE_TRANSITIONS` with `pending_approval → changes_requested`, `changes_requested → draft`, `changes_requested → pending_approval`; include it in `POST_STATE_ORDER`.
- `src/components/calendar/post-card.tsx` and `src/components/calendar/editor/state-change-dropdown.tsx`: pick up the new state via the existing meta map (no hardcoded lists).

## 3. Routing

`src/App.tsx`: replace the single `/portal/:slug` placeholder with a nested portal under `RequireClientAuth`:

```text
/portal                       -> PortalRedirect (logic below)
/portal/:slug                 -> PortalShell
  index                       -> ClientHome
  aprobaciones                -> ClientApprovals
  calendario | documentos
  reportes | activos
  credenciales                -> PortalComingSoon (Phase 5.2/5.3)
```

`/portal` **(bare) redirect logic** (new component `PortalRedirect.tsx`):

1. If user is not authenticated → redirect to `/portal/login`
2. Fetch user's `client_users` rows where status in ('active','invited')
3. If 0 rows → "No tienes acceso a ningún portal" empty state with mailto to support
4. If 1 row → redirect to `/portal/{client.slug}` (with `?post={id}` preserved if present in original URL)
5. If 2+ rows → render `ClientSelector` page showing each accessible client as a card (logo + name) → click navigates to that client's portal

`src/pages/portal/Login.tsx`: after a successful sign-in, look up the user's first active/invited `client_users` row, then redirect:

- if `pending_approval` count > 0 → `/portal/:slug/aprobaciones`
- else → `/portal/:slug`

## 4. Layout & theming

`src/layouts/PortalShell.tsx`:

- Top bar (h-16, white, border-b): client logo / initials in `brand_primary_color`, client name (Mulish Bold), "Powered by Astratta Agency" microtype, user avatar dropdown (Mi perfil / Cambiar contraseña / Cerrar sesión). Notifications bell deferred.
- Sidebar (w-64, `bg-card`, mobile Sheet): Inicio, Aprobaciones (red badge w/ pending count), Calendario, Documentos, Reportes, Activos, Credenciales; bottom "Contactar mi equipo" `mailto:` to workspace owner.
- Active item: 3px left bar in `--portal-primary` + same color at 8% opacity background.
- On mount, read `client.brand_primary_color` / `brand_secondary_color` and set `--portal-primary` (fallback `#5140f2`) and `--portal-secondary` (fallback `#ff7503`) on the shell root. All portal CTAs use `bg-[var(--portal-primary)]` — never `bg-primary`. Astratta colors only appear in the footer microtype.

**First-time invited splash + auto-activation**:

- If `client_users.status = 'invited'` and `auth.users.last_sign_in_at` is null OR `client_users.accepted_at` is null, show a centered "Bienvenida" modal:
  - Title: "Bienvenida al portal de {[client.name](http://client.name)}"
  - Body: "Tu equipo en Astratta Agency te invitó a colaborar. Aquí podrás aprobar contenido, ver reportes y acceder a tus documentos."
  - Button "Empezar" → updates `client_users.status='active'` AND `client_users.accepted_at=now()` → closes splash and reveals home
- Splash is non-dismissable except via the "Empezar" button (prevents the user from skipping the status transition).

## 5. Hooks (`src/hooks/portal/`)

- `useClientPortalContext(slug)` — load `clients` by slug, verify caller is in `client_users` with status in (`active`, `invited`); returns `{ client, currentClientUser, role }`. Throws on missing → caught by route error boundary. `enabled: !!slug && !!session?.user?.id` (avoid the race condition bug pattern we fixed before).
- `usePendingApprovals(clientId)` — `social_posts` where `client_id` matches & `status='pending_approval'`, joined with `post_variants[]`, ordered by `scheduled_for ASC`. Realtime: subscribe to `social_posts` UPDATE/INSERT filtered by `client_id` via `supabase.channel`, invalidate query on event. `enabled: !!clientId`.
- `useApprovalActions()` — exposes `approvePost`, `requestChanges`, `rejectPost`. Each updates the post + inserts a `content_approval_history` row (action + comment/reason). Optimistic cache updates; rollback on error.
- `useClientPortalKpis(clientId)` — counts: posts published this month, pending approvals, posts scheduled in next 7 days, nearest upcoming project deadline. **Each count is its own subquery**: don't share with the approvals list (different filter requirements).
- `useClientTeam(clientId)` — up to 5 `workspace_members` assigned to this client's projects, joined to `profiles` for name/avatar/role. **Order by oldest project assignment first** (the team member who's been with this client longest shows first).

All hooks gated by `enabled: !!clientId` / `!!slug`, with React Query keys scoped by `clientId`.

## 6. Pages

`src/pages/portal/ClientHome.tsx` (`/portal/:slug`):

- Gradient welcome banner using portal primary/secondary; time-based greeting ("Buenos días/tardes/noches, {first_name}") + subtitle referencing `client.name`.
- 4 KPI cards (`grid-cols-2 md:grid-cols-4`): published this month, pending approvals (highlighted + linked to `/aprobaciones` when > 0), next scheduled post (relative), next project deadline.
- "Pendiente de tu acción" section (only when pending > 0): summary card + top 3 pending posts (channel icons, 60-char caption excerpt, relative scheduled time) with CTA to approvals page.
- "Próximos posts" horizontal timeline: last 7 days of approved/scheduled posts (read-only, click opens `PostPublicView` side panel).
- "Tu equipo en Astratta" widget: avatar group (max 5 + "+N"), list with name/role and per-member `mailto:` button.

`src/pages/portal/ClientApprovals.tsx` (`/portal/:slug/aprobaciones`):

- Header with H1 + pending badge.
- Tabs: Pendientes (default), Aprobados, Cambios solicitados, Rechazados — pendientes sorted `scheduled_for ASC`, history tabs DESC.
- List of `ApprovalCard`. Empty states: green checkmark "Estás al día…" for Pendientes; neutral text for the rest.
- Deep link: `?post={id}` highlights & scrolls to that card on mount.
- After action: optimistic move to target tab, success toast with 5s "Deshacer", counter badge updates; if it was the last pending one, stay on the page showing the empty state.

## 7. Components (`src/components/portal/`)

`portal-header.tsx`, `portal-sidebar.tsx`, `portal-greeting-banner.tsx`, `portal-kpi-card.tsx`, `portal-pending-actions.tsx`, `portal-upcoming-posts.tsx`, `portal-team-widget.tsx`, `approval-card.tsx`, `approval-channel-tabs.tsx` (read-only variants display), `approval-actions.tsx` (3 buttons + inline confirms), `request-changes-dialog.tsx` (textarea min 10 chars, char counter), `reject-dialog.tsx` (reason min 10 chars), `post-media-lightbox.tsx`, `post-public-view.tsx` (side panel read-only view), `portal-redirect.tsx` (the /portal bare router), `client-selector.tsx` (when user has multiple clients).

UX details enforced in these components:

- Mobile ApprovalCard stacks vertically with sticky bottom actions + iOS safe-area inset.
- Action buttons show spinner + disable while mutation runs.
- Dialogs in Spanish with live char counters.
- Defensive: if any media asset has `consent_signed=false`, Aprobar shows an inline confirm before submitting.
- **Role-gated UI**: if `currentClientUser.role === 'client_viewer'`, hide the 3 action buttons completely and replace with a "Solo lectura" tooltip. Viewers see content but cannot approve/reject.

## 8. Out of scope (deferred)

- Calendar / Documentos / Activos pages (Phase 5.2)
- Reportes / Credenciales (Phase 5.3)
- Wiring `send-content-approval-request` email (parked, tracked in `docs/follow-ups.md`)
- Real-time push to client devices
- Notifications bell inside the portal

## 9. Files

Created:

- `docs/migrations/010_post_status_changes_requested.sql` (conditional + RLS audit if needed)
- `src/layouts/PortalShell.tsx` (replaces current shell)
- `src/hooks/portal/{useClientPortalContext,usePendingApprovals,useApprovalActions,useClientPortalKpis,useClientTeam}.ts`
- `src/pages/portal/{ClientHome,ClientApprovals,PortalRedirect,ClientSelector}.tsx`
- `src/components/portal/*` (14 components listed above)

Edited:

- `src/App.tsx` (nested portal routes + /portal bare router)
- `src/lib/post-states.ts` (new status + transitions)
- `src/components/calendar/post-card.tsx`, `src/components/calendar/editor/state-change-dropdown.tsx` (pick up new state)
- `src/pages/portal/Login.tsx` (post-login smart redirect)
- `src/pages/portal/Home.tsx` (removed — replaced by `ClientHome`)

## 10. Verification

- Sign in as a 180 Grados client user → land on home or approvals based on pending count.
- Move a post in the agency calendar to `pending_approval` → portal list updates in realtime.
- Approve / Request changes / Reject from the portal → status + history row written, agency calendar updates via Phase 4.4 trigger, notification row appears for agency members.
- Deep link `/portal/:slug/aprobaciones?post=<id>` scrolls to the card.
- Portal CTAs render in client brand colors; Astratta colors only in footer microtype.
- **As** `client_viewer` **role**: cannot see approval buttons, only read-only display.
- **First-time invited user**: welcome modal appears + status transitions to active after click.
- **Bare /portal** with 1 client → redirects to that client. With 2+ → shows selector.

Approve and I'll implement.