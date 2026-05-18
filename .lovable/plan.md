## Phase 3 — Global Projects view at `/app/proyectos`

Reemplazar el placeholder por el cockpit operativo de proyectos a nivel agencia.

### 1. Migración — `docs/migrations/006_projects_global_view.sql`

- `alter table public.projects add column if not exists assigned_team_ids jsonb not null default '[]'::jsonb;`
- `description` ya existe (omitir).
- `create index if not exists idx_projects_ws_status_end on public.projects (workspace_id, status, end_date);`
- `create index if not exists idx_projects_assigned_team_gin on public.projects using gin (assigned_team_ids);` — necesario para que el filtro "Asignados a mí" use `assigned_team_ids @> '["<userId>"]'::jsonb` con buen performance.
- Sin tablas nuevas, sin cambios en RLS.

### 2. Dependencias

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `use-debounce` (~1KB).

### 3. Hooks nuevos — `src/hooks/`

- `useProjects.ts`
  - `useProjects(workspaceId, filters)`: 
    - Join `projects` + `clients(name, slug, logo_url, brand_primary_color)`.
    - **Server-side filters** (para que escale a 100+ proyectos): `workspace_id`, `status` (in), `type` (in), `client_id` (in), `assigned_to_me` (usando `assigned_team_ids @> [auth.uid()]`), `search` (ilike por nombre).
    - **Client-side**: nada — todos los filtros se mandan a Supabase para que no carguemos 500 rows que después filtramos en el browser.
    - Búsqueda con debounce 300ms (`use-debounce`) para no spamear queries mientras el usuario tipea.
    - `enabled: !!workspaceId`.
    - StaleTime 30s, refetchOnWindowFocus true (cockpit operativo, queremos data fresca al volver a la tab).
  - `useProjectsStats(workspaceId)`: query separada que solo hace `select status, count(*) from projects group by status` + un `where end_date < today and status in ('planning','in_progress')` para overdue. NO derivar de `useProjects` (las stats deben reflejar TODO el workspace, no solo el resultado filtrado de la tabla).
  - `useUpdateProjectStatus()`: mutación optimista. On success inserta `client_timeline_events { event_type: 'project_status_changed', metadata: { from_status, to_status } }` con `client_id` y `workspace_id` del proyecto. On error: revert + toast `"No se pudo actualizar el estado"`.
  - `useWorkspaceMembers(workspaceId)`: list members con `profiles(full_name, avatar_url, email)` para el avatar group y el multi-select de "Equipo asignado" del wizard.

### 4. Componentes — `src/components/projects/`

- `projects-kpi-bar.tsx` (5 cards clickables; "Vencidos" highlight rojo si > 0). Cada card al click llama un setter del padre que aplica el filtro correspondiente. **Adicional**: agregar un botón sutil "Limpiar filtros" que aparece solo cuando hay filtros activos, al lado derecho del bar.
- `projects-filters-bar.tsx` (cliente multi, tipo chips, status chips, "Asignados a mí", search con debounce, toggle Lista/Kanban). En `<md` se colapsa en `Sheet` con botón "Filtros" + badge de count de filtros activos. **Persiste el state de filtros en URL search params** (`?clients=a,b&status=in_progress&view=kanban`) — así el usuario puede compartir links o usar el back button del browser.
- `projects-table.tsx` (tabla shadcn, sortable, columnas: Nombre, Cliente, Tipo, Status, Inicio, Deadline, Equipo, Progreso, menú 3 puntos). Paginación 25/50/100. Empty state con "Limpiar filtros". **Deadline overdue** (rojo) solo si `end_date < today AND status IN ('planning', 'in_progress')` — entregados/cerrados/pausados NO se marcan rojo aunque tengan fecha vieja.
- `projects-kanban.tsx` + `project-kanban-card.tsx` (columnas Planning / En ejecución / Pausado / Entregado / Cerrado; dnd-kit; scroll horizontal con snap en mobile; highlight de columna target con `border-secondary` en hover de drag). **Confirmation toast** después del drop exitoso: `"Movido a {nuevo estado}"` con botón "Deshacer" que revierte por 5 segundos. Evita errores de drop accidental.
- `project-type-selector.tsx` (grid visual 6 cards de tipo). Cada card con icono lucide específico: `Globe` (web_dev), `Instagram` (social_media), `Target` (paid_ads), `Palette` (graphic_design), `Sparkles` (branding), `Search` (audit). Hover state con `border-primary`.
- `new-project-global-dialog.tsx` (wizard 3 pasos: Cliente+Tipo → Detalles → Plantilla onboarding solo si `social_media`).
  - **Step 1 — Cliente Combobox**: incluye un link "+ Crear cliente nuevo" al final de la lista que abre el `new-client-dialog` existente. Evita que el user tenga que cerrar y reabrir flow.
  - **Step 2 — Validación de fechas**: si el usuario pone `end_date < start_date`, el botón Next se deshabilita y muestra error inline.
  - **Step 3 — Solo visible para** `social_media`: si type ≠ social_media, el wizard salta directo de Step 2 a submit (3 pasos máx visualmente, pero el flow se adapta).
  - Submit inserta en `projects` con `assigned_team_ids` como JSON array. Si template on para social_media: toast `"Plantilla aplicada (próximamente)"`. Navega a `/app/clientes/:slug` e invalida `projects`, `clients` y `useProjectsStats`.

Progreso (mock): Si `start_date` y `end_date` presentes y status `in_progress` → `Math.max(0, Math.min(100, (today - start) / (end - start) * 100))`. `delivered`/`closed` → 100. `planning` → 0. `paused` → muestra "—" (no progresa). Sin fechas → "—".

Equipo asignado: Avatares derivados de `assigned_team_ids` (join con `workspace_members` + `profiles` para nombre/avatar). UI de selección en wizard a partir de `useWorkspaceMembers`. Avatar group max 3 visibles + `+N` badge con tooltip listando los nombres.

### 5. Página — `src/pages/app/Proyectos.tsx`

Reemplazar `PlaceholderPage` con:

- H1 "Proyectos" + subtítulo + botón "Nuevo proyecto" (primary).
- `<ProjectsKpiBar onStatusClick={setStatusFilter} />` (los clics setean filtros).
- `<ProjectsFiltersBar />` con state local sincronizado a URL search params (`useSearchParams` de react-router).
- `view === 'lista'` → `<ProjectsTable />`, `view === 'kanban'` → `<ProjectsKanban />`.
- Click en fila de proyecto / botón "Abrir" → `toast("Detalle de proyecto próximamente")`.
- **Loading skeleton** mientras `useProjects.isLoading`: skeleton de tabla con 5 rows fantasma. Mejor UX que un spinner genérico.

### 6. Tokens de diseño

- Mini-logo cliente: si no hay `logo_url`, iniciales sobre fondo derivado de `client.brand_primary_color`.
- Status badge y service chips reutilizan los componentes existentes (`status-badge`, `services-chips`).
- Sin hex crudos en JSX salvo el inline-style del fallback de logo de cliente (color dinámico por dato).
- **Type icons**: usar `text-primary` en hover, `text-muted-foreground` en idle. Color animado.

### Fuera de scope

- Detalle `/app/proyectos/:id`.
- Cálculo real de progreso server-side.
- Auto-creación de tareas desde plantilla onboarding (deferred to Tareas module).
- Cambios de permisos.
- Bulk actions (multi-select de proyectos para cambiar status en masa) — defer hasta que tengas 20+ proyectos activos.

Aprobado → implemento todo en este loop.