## Phase 4.1 — Content Calendar base view en `/app/calendario`

Reemplazar el placeholder por el calendario de contenido funcional para un cliente a la vez. Editor multi-canal completo, uploads de assets y flujo de aprobación del cliente quedan deferidos a 4.2/4.3/4.4.

### 1. Migración — `docs/migrations/007_social_posts_calendar_fields.sql`

```sql
alter table public.social_posts add column if not exists channels text[] not null default '{}';
alter table public.social_posts add column if not exists content_pillar text;
alter table public.social_posts add column if not exists media_urls text[] not null default '{}';
alter table public.social_posts add column if not exists hashtags text;

create index if not exists idx_social_posts_client_scheduled
  on public.social_posts (client_id, scheduled_for);
create index if not exists idx_social_posts_workspace_status_scheduled
  on public.social_posts (workspace_id, status, scheduled_for);
create index if not exists idx_social_posts_channels_gin
  on public.social_posts using gin (channels);

create table if not exists public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  color text default '#5140f2',
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (client_id, name)
);

create index if not exists idx_content_pillars_client_order
  on public.content_pillars (client_id, sort_order);

alter table public.content_pillars enable row level security;

-- RLS policies for content_pillars (workspace_members CRUD, client_users SELECT)
drop policy if exists pillars_select on public.content_pillars;
create policy pillars_select on public.content_pillars
  for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and (
          public.is_workspace_member(c.workspace_id)
          or public.is_client_user(c.id)
        )
    )
  );

drop policy if exists pillars_insert on public.content_pillars;
create policy pillars_insert on public.content_pillars
  for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists pillars_update on public.content_pillars;
create policy pillars_update on public.content_pillars
  for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists pillars_delete on public.content_pillars;
create policy pillars_delete on public.content_pillars
  for delete to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

-- Seed default pillars for "180 Grados Med Spa" if the client exists
do $$
declare
  v_client_id uuid;
begin
  select id into v_client_id 
  from public.clients 
  where slug = '180-grados-med-spa' 
  limit 1;

  if v_client_id is not null then
    insert into public.content_pillars (client_id, name, color, description, sort_order)
    values 
      (v_client_id, 'Educativo',           '#5140f2', 'Información sobre tratamientos, cuidados, beneficios',                1),
      (v_client_id, 'Antes/Después',       '#ff7503', 'Resultados con disclaimer FTC y consentimiento firmado',              2),
      (v_client_id, 'Testimonios',         '#10b981', 'Reseñas y experiencias de pacientes con consentimiento',              3),
      (v_client_id, 'Behind-the-scenes',   '#3b82f6', 'Equipo, instalaciones, día a día del spa',                            4),
      (v_client_id, 'Promociones',         '#f59e0b', 'Ofertas, paquetes, eventos especiales',                               5)
    on conflict (client_id, name) do nothing;
  end if;
end $$;
```

`content_pillar` en `social_posts` queda como text (nombre del pilar, no FK) para tolerar pilares ad-hoc; la tabla `content_pillars` alimenta el select y el color. En el join lo resolvemos client-side mapeando por nombre dentro del cliente actual — esto evita una FK que rompería si renombran un pilar.

Nota: la migración debe aplicarse manualmente en Supabase SQL Editor antes de usar el calendario.

### 2. Hooks — `src/hooks/useSocialPosts.ts`

- `useSocialPosts({ workspaceId, clientId, dateRange:{from,to}, filters })`
  - select `social_posts.*` con `.gte('scheduled_for', from).lte('scheduled_for', to)`.
  - Server-side: `workspace_id`, `client_id`, `channels && {...}` (overlap array con `.overlaps`), `status in`, `content_pillar in`, `caption ilike` (debounce 300ms en la página).
  - StaleTime 30s. `enabled: !!workspaceId && !!clientId`.
  - Refetch on window focus = true (cuando el equipo edita en paralelo, los cambios aparecen al volver a la tab).
- `useContentPillars(clientId)` — `select * from content_pillars where client_id order by sort_order`. Agrega `{ name: "Sin pilar", color: "hsl(var(--muted-foreground))" }` al final en memoria.
- `useUpdatePostSchedule()` — optimista. Recibe `{ id, scheduled_for }`. Revert + toast en error con botón "Reintentar".
- `useCreatePost()` — insert mínimo (caption, scheduled_for, channels[], content_pillar, status, workspace_id, client_id, type='feed_post'). Invalida `social-posts`. Devuelve el row creado.
- `useUpdatePostStatus()` — cambio de estado; inserta `content_approval_history` cuando transiciona entre estados de revisión/aprobación.

### 3. Página — `src/pages/app/Calendario.tsx`

Composición:

```
<div class="space-y-4">
  <CalendarTopBar /> // sticky top, client selector + navigator + view toggle + "Nueva publicación"
  <CalendarFiltersBar />
  {view === 'mes' && <CalendarMonthView />}
  {view === 'semana' && <CalendarWeekView />}
  {view === 'lista' && <CalendarListView />}
  <PostDetailPanel /> // controlado por state
  <PostQuickCreateDialog /> // controlado por state
</div>
```

- Cliente activo: defaults al primer cliente activo del workspace; persiste última selección en `localStorage["calendario:last_client_id"]`. Si el cliente persistido fue borrado, fallback al primero activo.
- Empty state cuando 0 posts en el rango: ilustración `CalendarPlus`, headline "Aún no hay publicaciones para este período", CTA "Nueva publicación".
- Loading: skeleton de grilla mes (35 celdas) / week / table según view.

**Atajo de teclado**: presionar `N` (sin otro modificador y sin foco en input) abre el `PostQuickCreateDialog`. Aceleración crítica cuando estás planificando 30 posts el lunes en la mañana.

### 4. Componentes — `src/components/calendar/`

- `client-selector.tsx` — combobox con logo + nombre, search. Reusa `ClientLogo` existente. Persiste a localStorage. Si el workspace tiene 0 clientes activos, muestra inline empty state con CTA "Crear primer cliente" → `/app/clientes`.
- `calendar-navigator.tsx` — Prev/Hoy/Next + label ("Mayo 2026" o "12 – 18 May 2026"). Sabe del view actual para incrementar mes vs semana. Atajos `←` y `→` para navegar prev/next cuando no hay input enfocado.
- `calendar-filters-bar.tsx` — canales (multi chips con iconos), pilares (multi), estados (multi chips con color), search debounced. Badge de count + "Limpiar". Sheet en mobile.
- `calendar-month-view.tsx` + `day-cell.tsx` — grilla 7 col, min-h 140px, hoy con círculo `bg-primary`, días fuera de mes con `text-muted-foreground/50`. dnd-kit `DndContext` envolvente; celdas son `useDroppable`, cards son `useDraggable`. Drop preserva hora, cambia solo fecha. Click en celda vacía → quick create con date prefill. Max 3 posts visibles, "+N más" expande con Popover.
- `calendar-week-view.tsx` + `time-slot.tsx` — 7 cols × slots 6am–11pm cada 1h. Drop cambia timestamp completo (fecha + hora del slot). Scroll vertical con auto-scroll a 9am al montar.
- `calendar-list-view.tsx` — tabla shadcn sortable: fecha/hora, canal (iconos), formato, caption (60 chars), pilar (chip), estado (badge), acciones. Paginación 25/50/100. Default sort: scheduled_for asc.
- `post-card.tsx` — compact 80px en mes: iconos de canales (max 3 + "+N" si más), caption 1 línea truncate, thumbnail si `media_urls[0]`, dot de pilar, badge de estado. Hover: ring con secondary color. Cursor grab. Click → detail panel. Si scheduled_for < now() AND status NOT IN ('published','archived') → ring rojo sutil (señal de "post atrasado").
- `post-detail-panel.tsx` — `Sheet` lado derecho. Read-only: full caption, channels, scheduled_for (formato `dd MMM yyyy 'a las' HH:mm`), pilar, estado, thumbnails de media_urls (grid 3 cols), hashtags (como chips), history de cambios de estado desde `content_approval_history`. Botón "Editar" → toast "Editor completo próximamente". Botón "Cambiar estado" funcional usando `useUpdatePostStatus` con confirmación si el target es destructivo (archived/rejected). Botón "Duplicar" — crea copia con caption + media + pilar pero fecha = mañana 9am, status = 'draft'. Acelera la creación de variantes.
- `post-quick-create-dialog.tsx` — form: caption (Textarea ≤500 con counter), `scheduled_for` (date picker shadcn + time input HH:mm, default = mañana 9am), canales (multi chips), pilar (select), estado (default 'draft', selector que incluye 'pending_approval'). **Validación**: caption no vacío, scheduled_for entre `now() - 30 días` y `now() + 365 días` (med spas planifican lanzamientos con meses de anticipación; el límite original de 7 días era demasiado restrictivo). Al menos 1 canal seleccionado.
- `pillar-badge.tsx` — dot color + nombre (size sm/md).
- `state-badge-post.tsx` — badge con dot y label, color desde mapa.
- `channel-icon.tsx` — mapper canal → icono (lucide `Instagram`, `Facebook`, `Linkedin` + svg inline custom para `tiktok`, `x`, `threads`). Acepta size prop (sm 16px, md 20px).

### 5. Tokens de estado y canales

En lugar de hex crudos en componentes, agregar en `src/lib/post-states.ts`:

```ts
export const POST_STATE_META = {
  idea:                    { label: "Idea",            color: "hsl(0 0% 60%)" },
  draft:                   { label: "Borrador",        color: "hsl(217 91% 60%)" },
  pending_internal_review: { label: "Revisión interna",color: "hsl(38 92% 50%)" },
  pending_approval:        { label: "Esperando cliente",color:"hsl(23 100% 51%)" },
  approved:                { label: "Aprobado",        color: "hsl(142 71% 45%)" },
  scheduled:               { label: "Programado",      color: "hsl(245 87% 60%)" },
  published:               { label: "Publicado",       color: "hsl(158 100% 30%)" },
  rejected:                { label: "Rechazado",       color: "hsl(0 84% 60%)" },
  archived:                { label: "Archivado",       color: "hsl(0 0% 70%)" },
} as const;

export const POST_STATE_TRANSITIONS = {
  idea:                    ["draft", "archived"],
  draft:                   ["pending_internal_review", "pending_approval", "archived"],
  pending_internal_review: ["draft", "pending_approval", "rejected"],
  pending_approval:        ["approved", "rejected", "draft"],
  approved:                ["scheduled", "draft"],
  scheduled:               ["approved", "published", "archived"],
  published:               ["archived"],
  rejected:                ["draft", "archived"],
  archived:                ["draft"],
} as const;
```

Las transiciones definen el subconjunto de estados a los que se puede mover desde uno actual. El menú "Cambiar estado" en el detail panel solo muestra opciones válidas según `POST_STATE_TRANSITIONS[currentState]`. Evita transiciones inválidas tipo "published → draft".

Excepción aceptada al "no hex crudos": estos son datos de dominio (mapa de estados), igual que `brand_primary_color` de cliente. Se aplican vía `style={{ backgroundColor }}` en el dot, no en clases Tailwind.

### 6. URL search params

`useSearchParams`: `view`, `client_id`, `from`, `to`, `status`, `channels`, `pillars`, `q`. Compartibles vía link. Defaults: `view=mes`, rango = mes actual, client_id = localStorage o primer activo.

### 7. Responsive

- `<md`: month cells `min-h-[80px]`, max 1 post + "+N", header con día abreviado (3 letras).
- Week view en mobile: degrada a un solo día (selector de día) en columna vertical scroll.
- List view en mobile: solo columnas fecha + caption + estado.
- Filters bar → Sheet con trigger "Filtros" + badge de count.

### Detalles técnicos

- `dnd-kit/core` ya está instalado (Phase 3). Reutilizamos `DndContext` + `PointerSensor` con activation distance 5px para no romper clicks.
- date-fns ya disponible; usamos `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `startOfWeek`, `format` con locale `es`.
- Channels almacenados como `text[]`; query con `.overlaps('channels', selected)`.
- `pending_approval` desde quick-create NO dispara email aún (deferred 4.4); solo cambia status.

### Fuera de scope (4.2+)

- Editor completo multi-canal con variantes por canal.
- Hashtag suggestions, mentions autocomplete, UTM builder.
- Asset library y media uploads (solo URL string por ahora).
- Wire-up de `send-content-approval-request`.
- First comment IG, carousel/reel/story editing.
- Bulk ops, repeats, AI captions.

Aprobado → implemento todo en este loop.