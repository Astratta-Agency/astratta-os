## Client detail page — /app/clientes/:slug

Detail view for a single client with a 7-tab shell. Resumen, Proyectos, Notas internas, and Timeline ship fully functional. Documentos, Finanzas, and Credenciales render as "Próximamente" placeholders inside the tab shell so the navigation is complete from day one.

### Route & guards

- Add `<Route path="clientes/:slug" element={<ClienteDetalle />} />` inside the existing `/app` shell in `src/App.tsx` (already wrapped by `RequireAgencyAuth` + `AppShell`).
- Page resolves the client by `(workspace_id, slug)`. If not found → "Cliente no encontrado" empty state with a back link to `/app/clientes`.

### Database migration (single migration file)

New tables, all RLS-enabled with the existing `is_workspace_member` / `can_write_workspace` helper pattern, scoped through `client_in_member_workspace(client_id)`:

- `client_notes` — `id`, `client_id`, `body_md text`, `updated_by`, `updated_at`. One row per client (upsert on save). Workspace members read/write; never exposed to portal.
- `client_timeline_events` — `id`, `client_id`, `workspace_id`, `event_type text` (enum-like check: `client_created`, `project_created`, `project_status_changed`, `contact_added`, `contact_updated`, `note_updated`, `client_updated`, `manual`), `title`, `description`, `metadata jsonb`, `actor_id`, `occurred_at`. Workspace-only read.
- Triggers to auto-insert timeline rows: on `clients` insert (`client_created`) and on column update of name/status/industry (`client_updated`), on `projects` insert (`project_created`) and status update (`project_status_changed`), on `client_contacts` insert (`contact_added`) and update (`contact_updated`).
- Backfill: insert `client_created` rows for existing clients using `created_at`.

Storage and credential tables are intentionally deferred.

### Hooks (new in `src/hooks/`)

- `useClient(workspaceId, slug)` — fetches one client + embeds `client_contacts(*)` and `projects(id, name, type, status, start_date, end_date, budget_amount, retainer_monthly)`. Gated with `enabled: !!workspaceId && !!slug` (per the project's race-condition rule in `docs/decisions.md`).
- `useClientNotes(clientId)` + `useSaveClientNotes(clientId)` — fetch and upsert markdown body.
- `useClientTimeline(clientId, { eventType })` — read-only feed.
- `useCreateTimelineEvent(clientId)` — insert manual event (used by Timeline tab "Agregar evento").
- `useCreateProject(workspaceId, clientId)` — minimal insert (name, type, status default `planning`, optional dates/budget, optional retainer toggle) + invalidates client query.
- `useUpdateClient(clientId)` — partial update of `clients` row + invalidates queries (used by Editar dialog).
- `useUpsertClientContact(clientId)` — create or update contact row + invalidates query (used by Stakeholders inline add).

### Page composition

`src/pages/app/ClienteDetalle.tsx` orchestrates:

1. **Breadcrumb** above header: Clientes / {name}.
2. **Header** — `client-logo.tsx` (lg, 80px) + name (h1 Mulish bold), industry · location row, `status-badge`, and a circular health-score dial (new component, SVG, 64px, `#5140f2` track, mocked via existing `mockHealthScore`). Right side button cluster:
  - `Editar` → opens `edit-client-dialog.tsx` (full edit of all client fields including brand colors, logo URL, status, industry, website, location, notes-internal toggle)
  - `Crear proyecto` → opens new-project dialog
  - `Invitar al portal` → opens `invite-client-user-dialog.tsx` (collects email + role; sends invitation magic-link; placeholder for now if email infra not ready, but UI is live)
  - `Ver portal cliente` → opens `/portal/:slug` in new tab; tooltip "Disponible una vez invites al cliente"
3. `<Tabs defaultValue="resumen">` with all 7 triggers visible in declared order.

### Tab contents

#### Resumen

**6 KPI cards** in a responsive grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`):

- LTV (placeholder `—`)
- MRR (placeholder `—`)
- Proyectos activos (real count where status ∈ `planning|in_progress`)
- Posts este mes (placeholder `—`)
- **Tareas pendientes** (real count from `tasks` where `client_id` matches and status ∈ `todo|doing|review`)
- **Días como cliente** (today minus `clients.created_at`)

Below: two-column layout (`md:grid-cols-2`):

- Left card "Próximas entregas" — lists project rows with `end_date` in the next 60 days.
- Right card "Stakeholders" — lists contacts (name, role, email, phone) with the primary contact pinned and badged. Inline button "Agregar contacto" opens a small dialog using `useUpsertClientContact`.

**Proyectos** — Table of projects (name, type chip via existing `services-chips` label map, status badge, start, deadline, budget formatted USD, retainer indicator if `retainer_monthly = true`). Empty state "Aún no hay proyectos" + "Nuevo proyecto" CTA. Row click → toast "Detalle de proyecto próximamente". Header button "Nuevo proyecto" opens `new-project-dialog.tsx` (zod-validated: name ≤120, type required, optional dates with end ≥ start, optional budget ≥ 0, optional `retainer_monthly` switch with monthly amount when enabled). On submit: insert with `client_id` and `workspace_id` pre-filled.

**Documentos** — Placeholder card per section (Contratos, Propuestas, Recibos, Briefs, Brand Assets) with disabled "Subir" button and "Próximamente — almacenamiento de archivos en la siguiente iteración".

**Finanzas** — placeholder card "Próximamente — requiere tabla de facturas".

**Credenciales** — placeholder card "Próximamente — bóveda cifrada con pgsodium en construcción. No subas credenciales reales aún."

**Notas internas** — Markdown textarea (`Textarea`, monospace, min 320px tall) with live preview pane (`react-markdown` + `remark-gfm`) toggle. Debounced autosave (1.2s) calls `useSaveClientNotes`; saved-state indicator ("Guardado · hace Xs"). Helper line: "Solo visible para tu equipo, nunca para el cliente." Soporta básico: `# heading`, `**bold**`, `- bullet`, `[link](url)`, tablas vía `remark-gfm`.

**Timeline** — Vertical feed of `client_timeline_events` ordered desc; each item shows icon by `event_type`, title, description, relative time, and actor name (joined from `profiles`). Filter `Select` at top: Todos / Proyectos / Contactos / Notas / Cliente / Manual. Header button "Agregar evento" opens a small dialog (title, description, date) that creates a `manual` event via `useCreateTimelineEvent` — útil para registrar calls, reuniones, decisiones que no entran por triggers.

### New components (`src/components/clients/`)

- `health-score-dial.tsx` — SVG circular progress, brand-colored.
- `client-detail-header.tsx`
- `kpi-card.tsx` (small reusable; used in Resumen and possibly Dashboard later)
- `upcoming-deliveries.tsx`, `stakeholders-list.tsx`, `add-contact-dialog.tsx`
- `client-projects-tab.tsx` + `new-project-dialog.tsx`
- `client-notes-tab.tsx`
- `client-timeline-tab.tsx` + `add-manual-event-dialog.tsx`
- `edit-client-dialog.tsx`
- `invite-client-user-dialog.tsx` (UI only; magic-link send hooked to `supabase.auth.admin.inviteUserByEmail` if available, otherwise inserts into `client_users` as `invited` and surfaces a manual-share link)
- `tab-coming-soon.tsx` (shared placeholder card used by Documentos/Finanzas/Credenciales)

### Dependencies

Add `react-markdown` and `remark-gfm` for the notes preview. Add `date-fns` if not already present (for "hace Xs" relative time and 60-day deadline filtering). No other runtime deps.

### Design tokens

All colors via existing semantic tokens; primary `#5140f2` only via `bg-primary` / `text-primary`. Mulish via `font-display`. Mobile: tabs become horizontal scroll; KPIs collapse to 2 cols; header buttons collapse to icon group with overflow menu (3-dot) for secondary actions (`Invitar al portal`, `Ver portal cliente`).

### Out of scope (this iteration)

- Real LTV/MRR/posts (no invoices/posts tables).
- Documentos (Storage bucket + RLS), Finanzas (invoices), Credenciales (encrypted vault).
- Project detail page.
- Real magic-link invitation email — if Supabase Admin API not available client-side, the `invite-client-user-dialog` falls back to creating a row in `client_users` with status=`invited` and showing a "Send manually" message.

Approve and I'll implement.