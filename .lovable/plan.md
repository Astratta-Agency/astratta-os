## Build the Clients page at `/app/clientes`

Note: route in this project is `/app/clientes` (not `/clients`); existing sidebar already points there. Detail route will be `/app/clientes/:slug`.

### Files to create

- `src/hooks/useClients.ts` — React Query hooks: `useClients(workspaceId, filters)` and `useCreateClient()`. Fetches `clients` filtered by workspace + joins related `projects (id, type, status)` for services chips. Health score: temporary deterministic mock derived from `id` until a server function exists.
- `src/hooks/useActiveWorkspace.ts` — small helper that returns the first workspace from `useUserContext` (single source of truth; later replaceable by a workspace switcher).
- `src/components/clients/clients-filters.tsx` — search input, industry dropdown, status dropdown (Todos / Activos / Pausados / Churned → maps to enum `active | paused | churned`), location filter (default "Dallas-Fort Worth, TX"), and table/cards view toggle.
- `src/components/clients/clients-table.tsx` — shadcn `Table` with sortable columns: cliente (with logo thumb + name), industria, servicios chips, health score visual bar, status badge, próximo pago (placeholder "—" for now), 3-dot actions menu, and pagination (25/50/100).
- `src/components/clients/clients-grid.tsx` — responsive card grid (3/2/1 cols), each card shows: logo thumb (or initials fallback in client brand color), name, industry, services chips, health score, status badge. Click navigates to `/app/clientes/:slug`.
- `src/components/clients/client-logo.tsx` — small reusable component: renders `logo_url` if present, else generates initials avatar with the client's `brand_primary_color` as background. Sizes: sm (32px), md (48px), lg (80px).
- `src/components/clients/health-score-bar.tsx` — 0–100 horizontal bar, color shifts red→amber→green by threshold.
- `src/components/clients/status-badge.tsx` — badge variants for `prospect | active | paused | churned`. Spanish labels: Prospecto / Activo / Pausado / Churned.
- `src/components/clients/services-chips.tsx` — derives unique `project.type` values into compact chips with localized labels (Web Dev, Social Media, Paid Ads, Diseño, Branding, Auditoría).
- `src/components/clients/clients-empty-state.tsx` — centered Building2 lucide icon, headline "Aún no tienes clientes", subtitle "Crea tu primer cliente para empezar a operar", CTA button "Nuevo cliente".
- `src/components/clients/new-client-dialog.tsx` — shadcn `Dialog` with zod-validated form (react-hook-form already in repo). See full field list below.

### New client dialog — fields (extended)

**Sección 1: Datos generales**

- Nombre comercial (required, ≤120)
- Industria (dropdown required): Med Spa / Healthcare / Wellness / Retail / Industrial / Servicios Profesionales / Restaurante / Real Estate / Otro
- Website (optional, URL validation, ≤255)
- Ubicación (text, default "Dallas-Fort Worth, TX", ≤120)
- Status (dropdown, default "prospect"): Prospecto / Activo / Pausado / Churned

**Sección 2: Brand del cliente** (opcional, expandible — colapsada por default)

- Logo URL (optional, can paste URL or skip; upload to storage will come in detail page)
- Color primario (color picker, default `#5140f2`)
- Color secundario (color picker, default `#ff7503`)

**Sección 3: Contacto principal**

- Nombre del contacto (required, ≤120)
- Email (required, email validation, ≤255)
- Teléfono (optional, ≤40)
- Rol/cargo (optional, ≤80) — ej: CEO, Marketing Lead, Owner

On submit:

1. Generate slug client-side from name using `generate_slug` SQL helper via RPC OR equivalent client-side regex (lowercase, alphanumeric, hyphens, collapse duplicates)
2. Check slug uniqueness within workspace; on collision append `-2`, `-3`, …
3. Insert into `clients` with brand fields populated (use defaults if user skipped section 2)
4. Insert primary contact into `client_contacts` with `is_primary = true`
5. If contact insert fails, surface error but keep the client (acceptable trade-off without an RPC)
6. Toast "Cliente creado" + close dialog + invalidate clients query
7. Navigate to `/app/clientes/[new-slug]` so user lands directly on the new client's detail page (placeholder for now)  
  
Files to edit

- `src/pages/app/Clientes.tsx` — replace placeholder with the real page: header (h1 "Clientes" + subtitle "Gestiona todos tus clientes en un solo lugar"), right-aligned primary "Nuevo cliente" button (`#5140f2` via `bg-primary` token), filters bar, view toggle, table or grid, empty state when zero results, loading skeletons.

### Data & validation details

- Query: `clients` where `workspace_id = activeWorkspace.id`, filtered by status/industry/location/search (ilike on name). Embed `projects(id, type, status)`.
- Status filter mapping in UI: "Todos" (default, no filter) → "Activos" → `active`, "Pausados" → `paused`, "Churned" → `churned`, "Prospectos" → `prospect`. Show all four filter options (the original spec's "Todos / Activos / Pausados / Churned" plus Prospectos so the user can find leads-in-progress).
- Health score: `((parseInt(id.slice(0,8),16)) % 101)` for stable mocks until backend function exists.
- Próximo pago: rendered as `—` placeholder (no `invoices` table yet in core schema).
- Client-side zod schemas with trim + length caps on all text inputs (name ≤120, website ≤255, email ≤255, phone ≤40).
- Slug: try `generate_slug(name)` SQL helper via RPC if available; on collision append `-2`, `-3`, …; checked against existing slugs in the current workspace before insert.
- All color inputs validated as HEX `#RRGGBB`.  


### 3-dot actions menu (table & grid card)

- "Abrir ficha" → navigates to `/app/clientes/:slug`
- "Ver portal cliente" → opens `/portal/:slug` in new tab (will 403 until portal user is invited; OK for now, button shows tooltip "Disponible una vez invites al cliente")
- "Editar" → toast "Próximamente" (until detail page implemented)
- "Archivar" → toast "Próximamente"
- "Eliminar" → toast "Próximamente" (destructive action requires confirmation flow, deferred)

### Design tokens

All colors via existing semantic tokens (`bg-primary`, `text-foreground`, `text-muted-foreground`, `border-border`). Mulish via `font-display` / `font-sans` already configured. No raw hex in components.  
  
Mobile responsiveness

- Filters bar collapses to a single "Filtros" trigger that opens a Sheet drawer below md breakpoint
- Table view auto-switches to grid view on mobile (table is unusable < 768px)
- "Nuevo cliente" button collapses to icon-only (`+`) on mobile

### Out of scope

- Detail page `/app/clientes/:slug` (will be the next iteration immediately after this).
- Real health-score calculation (server function) and `próximo pago` (requires invoices table).
- Logo upload to Storage (will be on detail page; for now URL paste only).
- Inline status change in the table (clicking the badge does nothing for now).
- Bulk actions (multi-select + bulk archive). Defer until 5+ clients in the system.

Approve and I'll implement.