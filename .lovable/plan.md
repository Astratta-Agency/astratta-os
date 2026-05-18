## CSV Export for Content Calendar List View

### Goal

Add a one-click CSV export of filtered posts from the calendar list view, so agencies can share monthly content plans as spreadsheets.

### Files

- New: `src/lib/csv-export.ts` — `exportToCsv()` utility with UTF-8 BOM, comma delimiter, proper escaping (quotes for commas/newlines/double-quotes), and auto-download via Blob + anchor click.
- Edited: `src/components/calendar/calendar-list-view.tsx` — add "Exportar" button (ghost variant, Download icon) next to pagination controls.

### Implementation Details

1. **csv-export.ts**
  - Signature: `exportToCsv(filename: string, rows: Record<string, any>[], columns: { key: string; header: string; format?: (v: any) => string }[])`
  - Prepends `\uFEFF` for Excel accent support.
  - Escapes values containing comma, double quote, or newline by wrapping in `"` and doubling internal `"`.
  - **Sanitize filename**: replace any chars not in `[a-zA-Z0-9._-]` with `-`, collapse consecutive hyphens, trim leading/trailing hyphens. Ej: `astratta-calendar-180-grados-med-spa-2026-05-01-to-2026-05-31.csv`. Without this, una agencia con `Ã±` en el nombre rompe el download en algunos browsers.
  - **Empty rows guard**: if `rows.length === 0`, no-op + console.warn (defensive — el botón ya debería estar disabled, pero por si acaso).
2. **calendar-list-view.tsx changes**
  - Add `clientName`, `clientSlug`, `dateRangeFrom`, `dateRangeTo` props (or derive from parent context) to build filename: `astratta-calendar-{slug}-{from}-to-{to}.csv` (donde from/to son `yyyy-MM-dd`).
  - Build export rows from the currently filtered AND sorted `posts` (full set, not paginated slice — respetar el sort actual del usuario, no hardcodear scheduled_for asc).
  - Columns mapped:
    - **Fecha programada** (scheduled_for → `yyyy-MM-dd HH:mm` con `date-fns/format` y locale `es`; string vacío si null)
    - **Cliente** (clientName)
    - **Canales** (channels joined " | "; string vacío si array vacío, no "[]")
    - **Formato** (type)
    - **Pilar** (content_pillar or "Sin pilar")
    - **Estado** (POST_STATE_META label en español — "Esperando cliente", "Borrador", etc.)
    - **Caption** (full text, escaped — preserva line breaks dentro de quotes)
    - **Hashtags** (hashtags or "")
    - **Media URLs** (media_urls joined " | "; vacío si array vacío)
    - **URL del post** (empty placeholder por ahora; estructura ready para cuando exista `/app/calendario?post={id}`)
    - **Creado por** (empty placeholder — created_by join deferred)
    - **Creado en** (created_at formatted `yyyy-MM-dd HH:mm`)
  - UX:
    - Disabled with tooltip "No hay publicaciones para exportar con los filtros actuales" if `posts.length === 0`.
    - Confirm dialog (shadcn AlertDialog) if `posts.length > 200`: title "Exportar {N} publicaciones", body "Esto generará un archivo CSV con todas las publicaciones que coinciden con tus filtros actuales. ¿Continuar?", actions "Cancelar" y "Exportar".
    - Toast on success: "Exportado — {N} publicaciones".
    - Botón con `aria-label="Exportar publicaciones a CSV"` para accesibilidad.

### Out of scope

- PDF export, Excel .xlsx, custom column selection, month/week view export, created_by join