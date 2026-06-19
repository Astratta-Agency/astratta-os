# Vista de detalle de proyecto

Crear `/app/proyectos/:id` reutilizando los mismos componentes de presentación del detalle de cliente (`KpiCard`, `HealthScoreDial`, `TabComingSoon`, mismos estilos de tabs/breadcrumb/header), e integrar la navegación desde la tabla.

## 1. Routing y navegación

- `src/App.tsx`: agregar `<Route path="proyectos/:id" element={<ProyectoDetalle />} />` debajo de la ruta de Proyectos.
- `src/pages/app/Proyectos.tsx`: en `handleOpenProject`, reemplazar el `toast` por `navigate(`/app/proyectos/${p.id}`)` (e idem para Kanban si aplica).
- `ProjectsKanban` / `ProjectKanbanCard`: verificar que `onOpenProject` también navegue.

## 2. Hook nuevo `src/hooks/useProjectDetail.ts`

- `useProject(projectId)`: trae `projects.*` + `client:clients(id, name, slug, logo_url, brand_primary_color)` por id (usa el cliente Supabase). Devuelve también `assigned_team_ids` normalizado.
- `useProjectTeamMembers(workspaceId, ids[])`: reutiliza `useWorkspaceMembers` y filtra por ids.
- `useProjectTimeline(projectId, filter)`: consulta `client_timeline_events` filtrando por `metadata->>project_id = projectId` **o** `event_type = 'project_created'` con `metadata->>project_id`. Soporta `filter = "all" | "project_status_changed" | "manual"`.
- `useCreateProjectNote(projectId, clientId, workspaceId)`: inserta evento manual en `client_timeline_events` con `metadata.project_id = projectId`.

(No se requiere nueva tabla; ya existe `client_timeline_events` y `useUpdateProjectStatus` ya escribe ahí.)

## 3. Página `src/pages/app/ProyectoDetalle.tsx`

Estructura clonando `ClienteDetalle.tsx`:

- **Breadcrumb**: `Proyectos / [nombre del proyecto]` (link a `/app/proyectos`).
- **Header**:
  - Avatar cuadrado negro con iniciales del nombre del proyecto (componente local `ProjectAvatar` — mismo tamaño/estilo que `ClientLogo size="lg"` pero siempre fondo negro + iniciales blancas).
  - `h1` con el nombre del proyecto (`font-display text-3xl font-bold`).
  - Subtítulo flex con `·` como separador: `PROJECT_TYPE_LABEL[type]` · nombre del cliente (link a `/app/clientes/<slug>`) · `<ProjectStatusBadge status={...} />` (ya existe en `project-meta.tsx`).
  - Debajo: `<HealthScoreDial score={progreso} label="Progreso" />` usando `computeProgress(...)` (si null, mostrar 0 y nota "Sin fechas").
- **Botones top right (desktop + mobile)**:
  - "Editar" (outline, `Pencil`) → `toast({ title: "Editar próximamente" })`.
  - "+ Nueva tarea" (filled) → `toast({ title: "Tareas próximamente" })`.
  - Menú `...` (`DropdownMenu`) con: Duplicar / Archivar / Eliminar (todos abren toast "Próximamente").

## 4. Tabs

Mismo `Tabs` + `TabsList` que cliente.

### Resumen
- Grid de KPI cards (mismo `KpiCard`):
  - CLIENTE → nombre, clickeable (link a `/app/clientes/<slug>`).
  - DEADLINE → `end_date` formateada `dd MMM yyyy`. Si vencida (`isOverdue`), texto en rojo (`text-destructive`).
  - DÍAS RESTANTES → `differenceInDays(end_date, today)`; si negativo, formato `-Xd` en rojo.
  - PRESUPUESTO → `budget_amount` formateado en `$` (Intl.NumberFormat USD); "—" si null.
  - INICIO → `start_date` formateada o "—".
  - PROGRESO → `${computeProgress(...) ?? 0}%`.
- Grid 2 columnas:
  - **Card "Descripción"**: textarea/inline edit; si vacía, placeholder gris "Agrega una descripción del proyecto...". Persistir en `projects.description` con `updateProject` mutation (botón Guardar al hacer cambios; igual al patrón de notas del cliente).
  - **Card "Equipo asignado"**: lista de `assigned_team_ids` mapeados a `WorkspaceMember` (avatar + full_name + role). Si vacío: "—" "Sin equipo asignado".

### Tareas
`TabComingSoon` con título "Las tareas de este proyecto aparecerán aquí" + subtexto "Podrás crear, asignar y hacer seguimiento de tareas directamente desde el proyecto." + botón "+ Nueva tarea" deshabilitado con `Tooltip` "Próximamente".

### Archivos
`TabComingSoon` con título "Archivos próximamente" y subtexto "Contratos, briefs, entregables y assets del proyecto se subirán a Supabase Storage en la siguiente iteración."

### Actividad
Clon de `ClientTimelineTab` adaptado:
- Select filtro a la izquierda (Todos / Cambios de estado / Notas).
- Botón "Agregar nota" a la derecha (mismo dialog que cliente).
- Timeline vertical con línea + círculos.
- Inyectar primera entrada virtual: `Proyecto creado — formatDistanceToNow(created_at)`.
- Para `project_status_changed`: render `${name}: ${PROJECT_STATUS_LABEL[from]} → ${PROJECT_STATUS_LABEL[to]}`.

## 5. Mutations adicionales en `useProjects.ts`
- `useUpdateProjectDescription({ projectId, description })`: update simple e invalida `["project", id]`.

## 6. Detalles de estilo

- Reutilizar 100% tokens existentes (`KpiCard`, `Card`, `TabsTrigger`, badges semánticas). Sin colores hardcodeados.
- `ProjectStatusBadge` ya existe; usar tal cual.
- Si `client` no existe (huérfano): mostrar "—" en lugar del link.
- Loading: skeleton análogo al de cliente.
- 404: "Proyecto no encontrado" + botón volver.

## Archivos

Creados:
- `src/pages/app/ProyectoDetalle.tsx`
- `src/hooks/useProjectDetail.ts`
- `src/components/projects/project-avatar.tsx`
- `src/components/projects/project-timeline-tab.tsx`
- `src/components/projects/project-description-card.tsx`
- `src/components/projects/project-team-card.tsx`

Editados:
- `src/App.tsx` (ruta nueva)
- `src/pages/app/Proyectos.tsx` (navegación en `handleOpenProject`)
- `src/hooks/useProjects.ts` (mutation `useUpdateProjectDescription`)

## Verificación

- Click en una fila de Proyectos navega a `/app/proyectos/:id`.
- KPIs muestran datos reales; "—" cuando faltan.
- Cambiar status desde la tabla genera entrada en Actividad del detalle.
- Tabs Tareas/Archivos muestran empty state.
- Editar descripción persiste en Supabase.
