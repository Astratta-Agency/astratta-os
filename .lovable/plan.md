# Modal "Editar proyecto"

Implementar el botón **Editar** del detalle de proyecto abriendo un Dialog con formulario prellenado.

## Archivos

**Crear** `src/components/projects/edit-project-dialog.tsx`
- Dialog de shadcn (`sm:max-w-lg`), formulario con `react-hook-form` + `zod` (ya usados en el proyecto).
- Props: `open`, `onOpenChange`, `project` (objeto del hook `useProject`), `clients` (lista activa del workspace).
- Schema zod:
  - `name`: string, trim, min 3, max 120
  - `type`: enum `web_dev | social_media | paid_ads | design | branding | audit`
  - `status`: enum `planning | in_progress | paused | delivered | closed`
  - `client_id`: uuid, requerido
  - `start_date`: date opcional
  - `end_date`: date opcional — `refine` para validar `end_date >= start_date`
  - `budget_amount`: number ≥ 0 nullable
  - `progress`: number entero 0–100 nullable
- Campos UI (en orden pedido):
  1. Nombre — `Input`
  2. Tipo — `Select` con labels de `PROJECT_TYPE_LABEL`
  3. Status — `Select` con labels en español (Planning, En ejecución, Pausado, Entregado, Cerrado)
  4. Cliente — `Popover + Command` (mismo patrón que `new-project-global-dialog.tsx`)
  5. Fecha inicio — `Popover + Calendar` (shadcn datepicker, `pointer-events-auto`)
  6. Deadline — idem
  7. Presupuesto — `Input type=number` con prefijo `$`
  8. Progreso — `Slider` 0–100 + valor visible `XX%`
- Footer: `Cancelar` (variant outline, cierra) y `Guardar cambios` (loading con spinner cuando `isPending`, disabled).
- Si el `status` cambia, además del UPDATE registra evento en `client_timeline_events` (mismo payload que `useUpdateProjectStatus`) para preservar el timeline.

**Crear hook** `useUpdateProject` dentro de `src/hooks/useProjects.ts`
- `useMutation` que recibe `{ projectId, patch, statusChange? }`.
- Hace `update` sobre `projects` con los campos editables + `updated_at`.
- Si `statusChange` (from ≠ to) → inserta `client_timeline_events` como en `useUpdateProjectStatus`.
- `onSuccess`: invalida `["projects"]`, `["projects-stats"]`, `["project", projectId]`, `["client-timeline"]`.
- Toast: éxito `"Proyecto actualizado"`, error muestra `error.message`. Toasts en el componente, no en el hook.

**Editar** `src/pages/app/ProyectoDetalle.tsx`
- Añadir `useState` `editOpen`.
- Cambiar los dos botones "Editar" (desktop + mobile) para hacer `setEditOpen(true)` en vez del toast placeholder.
- Renderizar `<EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} clients={activeClients} />`.
- Cargar `activeClients` reutilizando `useClients(workspace?.id)` ya existente, filtrando activos (mismo filtro que usa `Proyectos.tsx`).

## Notas técnicas
- Reutilizar `PROJECT_TYPE_LABEL` de `project-meta.tsx`.
- Sin nuevos componentes UI: `Dialog`, `Input`, `Select`, `Popover`, `Calendar`, `Slider`, `Button`, `Form*` de shadcn.
- Toast con `sonner` (`toast.success` / `toast.error`).
- No tocar lógica de otros módulos.
