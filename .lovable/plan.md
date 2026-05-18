# Plan: `send-content-approval-request`

Replica la arquitectura de `send-portal-invite` (Amazon SES v2 + SigV4 inline, sin SDKs) para notificar a los `client_admin` cuando un `content_item` queda listo para aprobación.

## 1. Tabla `social_posts` (migración nueva)

Importante: la tabla se llama `social_posts` (alineada con la estructura del módulo Social Media Management ya definida en `astratta-os-estructura.md`), NO `content_items`. Esto evita refactor cuando se construya el módulo completo de calendario.

`docs/migrations/005_social_posts_minimal.sql`:

```text
create type post_type as enum ('feed_post', 'carousel', 'reel', 'story', 'video', 'other');
create type post_status as enum ('draft', 'pending_internal_review', 'pending_approval', 'approved', 'rejected', 'scheduled', 'published', 'archived');

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  type post_type not null default 'feed_post',
  preview_url text,
  caption text,
  scheduled_for timestamptz,
  status post_status not null default 'draft',
  -- Approval tracking (lightweight; full approvals table comes later)
  last_approval_sent_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  -- Audit
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_social_posts_client_status on public.social_posts (client_id, status);
create index idx_social_posts_workspace_scheduled on public.social_posts (workspace_id, scheduled_for);
```

`approval_history` table (for audit trail — important for med spa compliance):

```sql
create table public.content_approval_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  action text not null check (action in ('sent_for_approval', 'approved', 'rejected', 'resent', 'auto_expired')),
  actor_user_id uuid references auth.users(id),  -- null when triggered by system
  recipient_emails text[],  -- for sent_for_approval rows
  comment text,
  ses_message_ids jsonb,  -- map of email -> messageId or error
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_approval_history_post on public.content_approval_history (post_id, created_at desc);
```

RLS:

- **workspace_members** del cliente: CRUD completo en ambas tablas.
- **client_users** del cliente con role `client_admin` o `client_viewer`:
  - `social_posts`: SELECT cuando `status in ('pending_approval','approved','rejected','published')`. NUNCA ven drafts ni internal reviews.
  - `content_approval_history`: SELECT (read-only).
- **client_admin** (no viewer): UPDATE en `social_posts.status` solo entre `pending_approval ↔ approved` y `pending_approval ↔ rejected`, validado vía DB trigger que recibe los inputs de `approved_by_user_id`, `rejection_reason`, etc.
- **content_approval_history**: INSERT permitido a workspace_members y a client_admins (estos solo con `action in ('approved','rejected')`). UPDATE/DELETE prohibido para todos (audit log inmutable).

Trigger SQL `trg_notify_content_approval`:

- AFTER UPDATE de `status` cuando `NEW.status='pending_approval'` y `OLD.status<>'pending_approval'`
- AFTER INSERT cuando `status='pending_approval'`
- Hace `pg_net.http_post` a la Edge Function con `{ post_id, source:'trigger' }` y el header `x-internal-secret` desde `vault` (secret `INTERNAL_TRIGGER_SECRET`).
- También inserta row en `content_approval_history` con `action='sent_for_approval'` y `actor_user_id = auth.uid()`.

## 2. Edge Function `supabase/functions/send-content-approval-request/index.ts`

Copia la arquitectura de `send-portal-invite`:

- Reusa la arquitectura de `send-portal-invite`. **Refactor recomendado**: extrae helpers SigV4 a `supabase/functions/_shared/ses.ts` (`sha256Hex`, `hmac`, `toHex`, `signSesRequest`, `sendSesEmail`) y úsalos desde ambas funciones. Reduce duplicación de ~80 LOC.
  - CORS: `npm:@supabase/supabase-js@2/cors`.
  - `verify_jwt`: por defecto Lovable. Permite bypass cuando header `x-internal-secret` matches `INTERNAL_TRIGGER_SECRET` env var (para llamadas desde el trigger SQL).
  - Zod body:
  ```text
  z.object({
    post_id: z.string().uuid(),
    source: z.enum(['manual', 'trigger']).default('manual'),
    force: z.boolean().default(false)  // bypass idempotency for manual resend
  })
  ```

### Handler flow

1. Validate `x-internal-secret` if `source='trigger'`, else validate JWT and check caller is in workspace_members.
2. Service-role client → fetch:
  - `social_posts` (full row) — 404 si no existe o `status<>'pending_approval'`.
  - `clients` (name, slug, workspace_id, brand_primary_color, brand_secondary_color, logo_url).
3. **Idempotency check** (skip if `force=false`):
  - Query: `SELECT created_at FROM content_approval_history WHERE post_id=$1 AND action='sent_for_approval' ORDER BY created_at DESC LIMIT 1`
  - If exists AND `created_at > now() - interval '4 hours'` → return `{ emailed: true, sent: 0, skipped: true, reason: 'duplicate_within_4h_window' }`.
  - Si `force=true`, ignora el check (manual resend bypass).
4. Resolver destinatarios:
  ```text
   Validate x-internal-secret if source='trigger', else validate JWT and check caller is in workspace_members.
  Service-role client → fetch:

  social_posts (full row) — 404 si no existe o status<>'pending_approval'.
  clients (name, slug, workspace_id, brand_primary_color, brand_secondary_color, logo_url).


  Idempotency check (skip if force=false):

  Query: SELECT created_at FROM content_approval_history WHERE post_id=$1 AND action='sent_for_approval' ORDER BY created_at DESC LIMIT 1
  If exists AND created_at > now() - interval '4 hours' → return { emailed: true, sent: 0, skipped: true, reason: 'duplicate_within_4h_window' }.
  Si force=true, ignora el check (manual resend bypass).


  Resolver destinatarios:
  ```
  - Dedupe + filter nulls.
  - If empty → return `{ emailed: false, error: 'no_recipients', recipient_count: 0 }` (200). Manual fallback en UI.
5. portalUrl = ${SITE_URL || Origin}/portal/${slug}/aprobaciones/${post_id}
6. Render HTML (mismo sistema visual que invite): 
  - Header bar 60px con `brand_primary_color`
  - Logo del cliente (si existe)
  - H1: "Nuevo contenido para aprobar"
  - **Tarjeta de preview** con:
    - `preview_url` (img max-width: 480px, border-radius 8px)
    - `title` (h2)
    - `type` badge en `brand_primary_color`
    - "Programado para: " + `scheduled_for` formateado en español (`dd MMM yyyy 'a las' HH:mm`)
    - "Cliente: " + `client.name`
    - Primeros 200 chars de `caption` + "..." si excede
  - CTA "Revisar y aprobar" en `brand_primary_color` → `portalUrl`
  - Helper: "También puedes solicitar cambios o rechazar el contenido desde el portal"
  - Footer Astratta + línea legal mínima
  - Versión texto plano equivalente
7. **Envío con estrategia BCC controlada** (mejora vs envío 1-por-1):
  - Si hay 1 destinatario → envío directo con `ToAddresses: [email]`.
  - Si hay 2+ destinatarios → 1 envío por destinatario en paralelo (Promise.all) con `ToAddresses: [email]` cada uno. NUNCA usar BCC con múltiples emails en el mismo envío (algunos clientes lo flagean como spam y exponen el resto del array si hay bug).
  - Esto mantiene privacidad (cada cliente solo ve su email) y permite trackear messageId por destinatario.
  - Reusa la misma SigV4 session por throughput.
8. **Inserta row en** `content_approval_history` con:
  - `action: 'sent_for_approval'` (o `'resent'` si `force=true`)
  - `actor_user_id`: caller si `source='manual'`, null si `source='trigger'`
  - `recipient_emails`: array de emails enviados
  - `ses_message_ids`: objeto `{ "email@x.com": "msg-id-..." }` o `{ "email@x.com": "error: ..." }`
  - `metadata`: `{ source, force, scheduled_for, brand_color_used }`
9. **Update** `social_posts.last_approval_sent_at = now()`.
10. Respuesta:

```json
    {
      "emailed": true,  // true si ≥1 envío OK
      "sent": 2,
      "failed": 0,
      "skipped": false,
      "results": [
        { "email": "owner@180grados.com", "messageId": "01000196..." },
        { "email": "marketing@180grados.com", "messageId": "01000196..." }
      ]
    }
```

```
Siempre 200 para que el caller maneje fallback.
```

## 3. Hook UI `useRequestContentApproval`

Nuevo en `src/hooks/useContentApproval.ts`:

```ts
mutationFn(postId, opts?: { force?: boolean }):
  1. Si status actual != 'pending_approval': update social_posts set status='pending_approval' where id=postId
     (esto dispara el trigger automático)
  2. Invoke send-content-approval-request con { post_id, source: 'manual', force: opts?.force ?? false }
  3. Return { emailed, sent, failed, skipped, results }
```

- Toasts:
  - `emailed && sent > 0 && !skipped` → "Aprobación solicitada — enviado a {sent} admin(s)"
  - `skipped` → "Ya se envió una solicitud hace menos de 4 horas" + botón "Reenviar de todos modos" (que llama con `force: true`)
  - `!emailed && error === 'no_recipients'` → "No hay client_admin para este cliente. Invita uno desde la ficha." + botón "Ir a Stakeholders"
  - `!emailed` (otros errores) → "Estado actualizado. Avisa al cliente manualmente — copia el link." con botón copiar `portalUrl`

## 4. Secrets requeridos (ya existentes + 1 nuevo)

Reusa los del invite: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `FROM_EMAIL`, `REPLY_TO_EMAIL`, `SITE_URL`.

Nuevo:

- `INTERNAL_TRIGGER_SECRET` — para validar llamadas desde el trigger SQL. Generar con `openssl rand -hex 32` y guardar en Supabase Edge Functions secrets + en Postgres vault para que el trigger lo lea.

## 5. Out of scope

- Magic links aprobar/rechazar sin login (descartado — el CTA va al portal autenticado)
- Page `/portal/{slug}/aprobaciones/{id}` (UI del portal — se construye en otro prompt)
- SNS bounce/complaint webhooks
- Reintentos automáticos (cae al copy-link manual)
- Notificación de aprobado/rechazado de vuelta al equipo Astratta (se hará en `send-content-approval-result` futuro — usará `content_approval_history` que ya queda lista)
- Variantes multi-canal del post (IG/FB/LinkedIn copy diferente) — campo `caption` único por ahora, se expande en módulo Calendario completo
- Asset library / media uploads — el `preview_url` por ahora es una URL externa

## Archivos

Crear:

- `docs/migrations/005_social_posts_minimal.sql`
- `supabase/functions/_shared/ses.ts` (extract SigV4 helpers)
- `supabase/functions/send-content-approval-request/index.ts` (~280 LOC, refactored to use _shared/ses)
- `src/hooks/useContentApproval.ts`

Editar:

- `supabase/functions/send-portal-invite/index.ts` — refactor para importar de `_shared/ses.ts` (DRY)