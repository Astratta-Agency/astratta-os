## Add "Invitar al portal" button to client detail header

Adds the missing portal invitation flow specified in the original plan but skipped in the previous build.

### Schema change (new migration: `docs/migrations/004_client_user_invites.sql`)

The current `client_users` table requires `user_id` (FK to `auth.users`) and has no invitation state. To support `status='invited'` inserts before the invitee has an account, the migration:

- Makes `client_users.user_id` nullable.
- Adds columns: `status text not null default 'active'` with check `in ('invited','active','revoked')`, `invited_email text`, `invited_by uuid references auth.users(id)`, `welcome_message text`, `invited_at timestamptz`, `revoked_at timestamptz`, `accepted_at timestamptz`.
- Adds a partial unique index on `(client_id, lower(invited_email))` where `status='invited'` to prevent duplicate pending invites.
- Updates the existing RLS check so workspace members can insert invites where `user_id is null` and `invited_email is not null`. The existing `client_users_write_member` policy already scopes by client → workspace membership; adjust the check expression to allow null `user_id` only when `status = 'invited'` and `invited_email IS NOT NULL`.
- Backfills `status='active'` for existing rows where `user_id IS NOT NULL`.

### New component: `src/components/clients/invite-client-user-dialog.tsx`

- Props: `open`, `onOpenChange`, `clientId`, `clientSlug`, `clientName`.
- Form (react-hook-form + zod): 
  - `email` — required, `.email()` validation, max 255 chars.
  - `role` — `Select` with `client_admin` / `client_viewer` (default `client_viewer`). Helper text below: "Admin puede aprobar contenido y editar datos. Viewer solo lectura."
  - `welcome_message` — optional `Textarea`, max 500 chars, placeholder: "Ej: Hola Juan, te invitamos al portal donde aprobarás contenido y verás reportes mensuales."
- Submit handler:
  1. Insert into `client_users` with `{ client_id, invited_email, role, welcome_message, status: 'invited', invited_by: auth.uid(), invited_at: now() }`. Handle 23505 (duplicate invite) with a friendly toast: "Ya existe una invitación pendiente para ese correo".
  2. Try `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: <portal URL> })`. The admin API is not available with the anon key in the browser, so this call will throw — wrap in try/catch and treat any failure as the manual fallback.
  3. **Fallback path** (this is the default path until we have an Edge Function for invites): keep the dialog open, swap the form for a "Invitación creada" success state showing: 
    - Green check icon + headline "Invitación creada"
    - Subtle helper: "El envío automático de correo estará disponible pronto. Por ahora, comparte este enlace con el cliente:"
    - Read-only input with the URL `${window.location.origin}/portal/login` (NOT the slug URL — clients log in to the portal root which then redirects them to their client based on `client_users` matching their email after they accept)
    - "Copiar enlace" button (lucide `Copy` icon, copies to clipboard, toast "Enlace copiado")
    - "Copiar mensaje completo" button — copies a pre-formatted message ready to paste into WhatsApp/email:

```text
Hola {clientName},
       
       Te invitamos al portal de Astratta Agency donde podrás aprobar contenido, ver reportes y acceder a tus documentos.
       
       Accede en: {portalUrl}
       Ingresa con este correo: {invitedEmail}
       
       {welcomeMessage if provided}
```

```text
 - "Cerrar" button to dismiss
```

- States: `isSubmitting` disables the submit button and shows a spinner. Success toast `"Invitación enviada a {email}"` only fires if step 2 succeeded (rare with anon key); otherwise no toast — the dialog itself shows the success state.
- Reset form on close.

### Header integration (`src/pages/app/ClienteDetalle.tsx`)

Insert the new button **between** "Crear proyecto" and "Ver portal cliente":

```text
[Editar] [Crear proyecto] [Invitar al portal] [Ver portal cliente]
```

- Desktop (`hidden md:flex`): full button cluster as today, with the new `Button` using `UserPlus` lucide icon and label "Invitar al portal".
- Mobile (`flex md:hidden`): primary actions remain inline (`Editar`, `Crear proyecto`); secondary actions (`Invitar al portal`, `Ver portal cliente`) collapse into a `DropdownMenu` triggered by a `MoreVertical` icon button. Each dropdown item carries its own icon.
- New dialog state: `const [inviteOpen, setInviteOpen] = useState(false);`
- Render `<InviteClientUserDialog open={inviteOpen} onOpenChange={setInviteOpen} clientId={client.id} clientSlug={client.slug} clientName={client.name} />` next to the existing `NewProjectDialog`.

### Hook: `useInviteClientUser(clientId)`

Co-located in `src/hooks/useClientDetail.ts` to match existing patterns. Wraps the insert + admin invite attempt + query invalidation for `["client", workspaceId, slug]` and a new `["client-invites", clientId]` query.

### New hook: `usePendingInvites(clientId)`

Returns rows from `client_users` where `client_id = clientId AND status = 'invited'`, with: `id`, `invited_email`, `role`, `invited_at`, `invited_by` (joined to profiles for `full_name`).

### Stakeholders tab update — show pending invites

In `src/components/clients/stakeholders-list.tsx` (or wherever the Resumen Stakeholders card lives), add a small section below the contacts list:

```
─── Invitaciones pendientes ───
[email]                    Admin · hace 2 días    [Revocar] [Copiar enlace]
[email]                    Viewer · hace 1 hora   [Revocar] [Copiar enlace]
```

- Each row: invited_email, role badge, relative time, two actions:
  - "Revocar" → updates status to `revoked` + sets `revoked_at = now()`. Toast "Invitación revocada".
  - "Copiar enlace" → copies the same portal URL + message used in the dialog success state.
- Section is hidden if no pending invites exist.
- Header: "Invitaciones pendientes" with count badge.

### Files

- Created: 
  - `docs/migrations/004_client_user_invites.sql`
  - `src/components/clients/invite-client-user-dialog.tsx`
  - `src/components/clients/pending-invites-list.tsx`
- Edited: 
  - `src/pages/app/ClienteDetalle.tsx`
  - `src/hooks/useClientDetail.ts`
  - `src/components/clients/stakeholders-list.tsx` (or equivalent in Resumen tab) to render `<PendingInvitesList />` below contacts

### Out of scope

- Real magic-link email delivery (requires server-side admin key or a Supabase Edge Function — can be a follow-up; structure already supports it).
- Resend invite action (UI placeholder OK for next iteration).
- Listing invites globally (per-client surface only for now).

You'll need to apply `004_client_user_invites.sql` in the Supabase SQL Editor after this lands.