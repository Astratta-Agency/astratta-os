# Plan: Edge Function `send-portal-invite` con Amazon SES

Reemplaza el approach Resend. Envío directo a SES v2 con SigV4 firmado en Deno (sin SDK).

## 1. Edge Function `supabase/functions/send-portal-invite/index.ts`

- `verify_jwt: true` (default Lovable). Validar JWT en código con `getClaims` igual.
- CORS preflight estándar (`corsHeaders` desde `npm:@supabase/supabase-js@2/cors`).
- Body con Zod:
  ```ts
  z.object({
    client_id: z.string().uuid(),
    email: z.string().email(),
    welcome_message: z.string().max(500).optional(),
  })
  ```

### Flujo

1. OPTIONS → 200.
2. Validar `Authorization: Bearer ...` → `getClaims` con anon client. 401 si falla. `userId = claims.sub`.
3. Service-role client (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) →
  - `clients.select('id, name, slug, workspace_id, brand_primary_color, brand_secondary_color, logo_url').eq('id', client_id).maybeSingle()` → 404 si no existe.
  - `workspace_members.select('user_id').eq('workspace_id', client.workspace_id).eq('user_id', userId).maybeSingle()` → 403 si no es miembro.
4. Service-role client → `workspaces.select('name').eq('id', client.workspace_id).maybeSingle()` → para el `From` display name personalizable y el footer.
5. `portalUrl` = `${SITE_URL ?? new URL(req.headers.get('origin') ?? '').origin}/portal/login`.
6. Generar `invite_id = crypto.randomUUID()` para tracking (irá en custom header del email + en logs).
7. Render HTML + texto plano (helpers inline, sin libs externas).
8. POST a SES v2 `https://email.${REGION}.amazonaws.com/v2/email/outbound-emails` con SigV4. Body JSON:
  ```json
   {
       "FromEmailAddress": "Astratta <invites@astrattaagency.com>",
       "Destination": { "ToAddresses": [email] },
       "ReplyToAddresses": ["hello@astrattaagency.com"],
       "ConfigurationSetName": "astratta-transactional",
       "EmailTags": [
         { "Name": "category", "Value": "portal_invite" },
         { "Name": "client_id", "Value": "<short-client-id>" },
         { "Name": "invite_id", "Value": "<invite_id>" }
       ],
       "Content": {
         "Simple": {
           "Subject": { "Data": "Te invitamos al portal de <Client> x Astratta", "Charset": "UTF-8" },
           "Body": {
             "Html": { "Data": "<html...>", "Charset": "UTF-8" },
             "Text": { "Data": "...", "Charset": "UTF-8" }
           }
         }
       }
     }
  ```
9. `ConfigurationSetName` es opcional: si la env `SES_CONFIGURATION_SET` no está definida, se omite del payload (no rompe el envío).
10. `EmailTags` permiten filtrar bounces/deliveries por categoría en CloudWatch sin esfuerzo extra.
11. **Retry policy**: si la respuesta de SES es 5xx o network error, reintentar hasta 2 veces con backoff exponencial (250ms, 750ms). 4xx (validation errors) NO se reintenta — devolver error inmediato.
12. Si 200 → `{ emailed: true, messageId, invite_id }`. Si error después de retries → `{ emailed: false, error, invite_id }` con status 200 (para que el dialog muestre fallback).
13. **Logging estructurado** (JSON.stringify a console.log con prefijo `[send-portal-invite]`): siempre log con shape `{ invite_id, client_id, recipient_email_hash, status, duration_ms, ses_message_id?, error? }`. Hash del email (SHA-256 truncado 8 chars) para evitar PII en logs.

### SigV4 helper (inline, ~80 LOC)

- Función `signRequest({ method, url, region, service: 'ses', body, accessKeyId, secretAccessKey })` que devuelve headers `Authorization`, `X-Amz-Date`, `X-Amz-Content-Sha256`, `Host`.
- Usa `crypto.subtle` (HMAC-SHA256, SHA-256) — disponible en Deno sin imports.
- Canonical request → string to sign → signing key (`AWS4` + secret → date → region → service → `aws4_request`) → signature.

### Template HTML

Estructura tabular (compatible Gmail/Outlook), inline styles:

- Outer `<table>` background `#f6f7fb`, content table 600px centered, `#ffffff`, border-radius 12.
- Header bar 60px, `background: ${brand_primary_color ?? '#5140f2'}`.
- Hero: si `logo_url` presente, `<img src="..." height="48" alt="${client.name} logo" />` centrado, sino skip. Headline `<h1>` "Te invitamos al portal de {Client Name}".
- Párrafo de bienvenida explicando capacidades (aprobar contenido, ver reportes, acceder documentos).
- Si `welcome_message` presente: blockquote con border-left `4px solid ${brand_primary_color}`, padding-left 16, color `#475569`, italic.
- CTA `<a>` botón: bg `${brand_primary_color ?? '#5140f2'}`, color blanco, padding `14px 28px`, border-radius 8, text "Acceder al portal", href `portalUrl`.
- Helper: "Inicia sesión con tu correo: **{email}**".
- Footer: hr, "Powered by Astratta Agency · astrattaagency.com" + logo Astratta (URL pública estable, hardcoded — TODO confirmar URL).
- Mini-línea legal final (gris claro 11px): "Recibes este correo porque {workspace.name} te invitó al portal cliente. Si no esperabas esta invitación, ignora este mensaje."
- Escape de `client.name` y `welcome_message` con helper `escapeHtml`.
- `meta` tag `<meta name="x-invite-id" content="{invite_id}" />` dentro del `<head>` para trazabilidad si alguien forwardea el email.

Texto plano: versión mínima con headline, mensaje, URL, login email.

## 2. Hook `src/hooks/useClientDetail.ts`

En `useInviteClientUser.mutationFn`, reemplazar el bloque `try { const adminApi = ... }` por:

```ts
let emailed = false;
let inviteId: string | null = null;
try {
  const { data, error: fnErr } = await supabase.functions.invoke("send-portal-invite", {
    body: { 
      client_id: clientId, 
      email: input.email.toLowerCase().trim(), 
      welcome_message: input.welcome_message ?? null 
    },
  });
  if (!fnErr && data?.emailed) emailed = true;
  inviteId = data?.invite_id ?? null;
} catch (e) { 
  console.warn('[useInviteClientUser] Edge function failed, falling back to manual share', e);
}
return { emailed, inviteId };
```

El insert previo en `client_users` queda igual. Opcional: guardar `inviteId` en el row de `client_users` (`metadata jsonb` o columna nueva `invite_id text`) para correlacionar con logs después.

## 3. Dialog

`invite-client-user-dialog.tsx` ya maneja `emailed: true` (toast + cierre) vs `false` (pantalla copia). Sin cambios estructurales.

Ajuste menor: cuando `emailed: true`, el toast pasa a `"Invitación enviada a {email}"` con un subtítulo discreto `"El correo puede tardar 1-2 minutos en llegar"`. Setea expectativa correcta y reduce los "no me llegó nada" del cliente.

## 4. Secretos requeridos

El usuario los configura manualmente en Supabase Dashboard → Edge Functions → Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (default `us-east-1` si falta)
- `FROM_EMAIL` (default `invites@astrattaagency.com`)
- `REPLY_TO_EMAIL` (default `hello@astrattaagency.com`)
- `SITE_URL` (default desde `Origin` header)
- `SES_CONFIGURATION_SET` (opcional, default omitido del payload — habilita event tracking si se setea)

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles automáticamente.

## Archivos

- **Nuevo:** `supabase/functions/send-portal-invite/index.ts` (~280 LOC incluyendo SigV4 + template + retry + logging)
- **Editado:** `src/hooks/useClientDetail.ts` (~12 LOC en `useInviteClientUser`)

## Fuera de alcance

- MIME multipart con attachments.
- Tracking de bounces/complaints (SNS) — los tags + Configuration Set dejan la base lista para activarlo después sin refactor.
- Reenvío automático en caso de fallo (queda manual).
- Verificación adicional de `astrattaagency.com` en SES (ya hecho por el usuario).
- Almacenar `invite_id` en `client_users` (no estructural — se puede agregar en migration futura si quieres correlación bidireccional).