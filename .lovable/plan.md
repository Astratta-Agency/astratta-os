# Authentication Flows — Astratta OS

This is a **Vite + React Router** project (not Next.js), so I'll implement the equivalent using Supabase Auth + a route-level guard component (`RequireAuth`) instead of Next.js middleware. Functionality and UX will match what was requested.

Several pieces already exist (`/login`, `/signup`, `/reset-password`, `/portal/login`, `/portal/forgot-password`, `RequireAuth`, `useAuth`). They need polishing, missing flows added, and stricter role-based gating.

---

## Architectural decisions

1. **Keep** `/app/*` **prefix — do NOT flatten URLs.** This is intentional: when we split into subdomains later (`app.astrattaos.com` / `portal.astrattaos.com`) via Vercel rewrites, the prefix maps trivially without URL changes. Flat URLs would require a refactor.
2. **Workspace creation uses an RPC, not direct insert.** A `create_workspace(_name text, _slug text)` SECURITY DEFINER function wraps insert + future business logic (welcome emails, default tags, default disclaimers). Owner membership is auto-created by the trigger from migration 001.
3. **Trial defaults**: every newly created workspace defaults to `subscription_status = 'trialing'` with `trial_ends_at = now() + interval '14 days'`. Schema field `trial_ends_at` added in migration 002.
4. **Dual-role users (rare but real)**: a user who is both `workspace_member` and `client_user` defaults to agency context after login, with a banner option to "Switch to client portal" (UI deferred — context detection live now).
5. **Magic link UX**: after submission, show a confirmation screen ("Te enviamos un enlace a tu correo") instead of silently redirecting. Don't reveal whether the email exists in DB (security best practice).
6. **All auth forms must show explicit loading states** (Supabase auth can take 1–2s on cold start). Use shadcn `Button` `disabled + loading spinner` pattern.  

  What I'll build

### 1. Agency auth (`/login`, `/signup`, `/forgot-password`)

- Add magic link option to `/login` (toggle: password ↔ magic link).
- Magic link submission → confirmation screen "Revisa tu correo. Te enviamos un enlace para iniciar sesión." → no auto-redirect.
- Rename existing `/reset-password` route to also be reachable via `/forgot-password` (alias) — keep `/reset-password` for the recovery landing (after clicking the email link, with token).
- Refresh signup headline to "Crea tu workspace y empieza a operar tu agencia como un studio".
- Signup form fields: full name, email, password, **agency name** (becomes workspace name).
- Signup flow:
  1. `auth.signUp()` with metadata `{ full_name }`
  2. On success, call RPC `create_workspace(_name => agencyName, _slug => generate_slug(agencyName))`
  3. Trigger from migration 001 auto-creates owner membership
  4. Workspace defaults: `subscription_status = 'trialing'`, `trial_ends_at = now() + 14 days`
  5. Redirect to `/onboarding`

### 2. Onboarding (`/onboarding`)

New page, gated by `RequireAgencyAuth`. 3-step wizard in a single card with progress dots at top.

**Step 1 — Workspace identity**

- Workspace logo upload (Supabase Storage bucket `workspace-logos`, public read)
- Agency display name (pre-filled from signup, editable)
- **Agency website** (optional, validated as URL)
- **Location** (text input, default `Dallas-Fort Worth, TX`)

**Step 2 — Primary services** Multi-select chips. Stored on `workspaces.services` (jsonb) as structured data (not just strings) for future per-service config:

json

```json
[
  { "key": "web_dev", "label": "Web Development", "enabled": true },
  { "key": "social_media", "label": "Social Media Management", "enabled": true },
  { "key": "paid_ads", "label": "Paid Ads", "enabled": false },
  { "key": "graphic_design", "label": "Graphic Design", "enabled": false },
  { "key": "branding", "label": "Branding", "enabled": false },
  { "key": "audit", "label": "Auditoría / Diagnóstico", "enabled": false }
]
```

**Step 3 — Done** Confetti-light moment + "Listo, tu workspace está activo." → redirect to `/app/dashboard`.

A flag `workspaces.onboarded_at timestamptz` decides whether to force-redirect users to `/onboarding` after login. If null → onboarding required.

### 3. Client portal auth (`/portal/login`, `/portal/forgot-password`)

- Keep invite-only (no signup link).
- Add magic link toggle (same UX as agency).
- After login: look up the user's `client_users` row(s):
  - If exactly one → redirect to `/portal/{client.slug}`.
  - If multiple → render a "Selecciona el portal" chooser card with each client's logo + name.
  - If zero → 403 page "No tienes acceso a ningún portal. Contacta a tu agencia."
- For now `/portal/:slug` renders the existing `PortalHome`.

### 4. Route protection

Replace the single `RequireAuth` with two role-aware guards:

- `RequireAgencyAuth` — requires session and at least one `workspace_members` row. If user is only a `client_users` member → redirect to `/portal/login`. If neither → redirect to `/login`.
- `RequireClientAuth` — requires session and a `client_users` row matching the slug param. If the user is agency-only → redirect to `/login`. If trying to access a slug they don't have → 403.

Both use a `useUserContext` hook that fetches both memberships once and caches them in React Query (staleTime 5 min).

**Dual-role users**: if a user has both, agency context wins by default. A banner appears at the top: "También tienes acceso a [Client Name] portal — Cambiar".

Protected agency routes: `/app/dashboard`, `/app/clientes`, `/app/proyectos`, `/app/calendario`, `/app/tareas`, `/app/finanzas`, `/app/reportes`, `/app/configuracion`, `/onboarding`.

Protected portal routes: `/portal`, `/portal/:slug`.

### 5. Logout

Add explicit logout handler in user menu (top bar): calls `supabase.auth.signOut()` and redirects to `/login`. Same for portal user menu → `/portal/login`.

#### 6. Design polish

- Centered card on white background (already in place); enforce `#5140f2` primary CTA via existing CSS tokens.
- Inline error text in `text-destructive` (already `#ef4444` via tokens).
- Success states: small `Check` icon (lucide) tinted with primary.
- Mulish font: confirm `tailwind.config.ts` / `index.css` font tokens — if missing, add `Mulish` import and set as default sans + `font-display` (Bold).
- All buttons get loading state (spinner + disabled) during async auth ops.
- Error mapping: translate Supabase auth errors to Spanish ("Invalid login credentials" → "Correo o contraseña incorrectos").

---

## Files to create

- `src/pages/Onboarding.tsx` — 3-step wizard
- `src/pages/portal/ClientHome.tsx` — slug-aware version of `PortalHome` (or rename + accept `:slug`)
- `src/pages/portal/ClientChooser.tsx` — when user has multiple client memberships
- `src/pages/auth/MagicLinkSent.tsx` — confirmation screen post magic-link request
- `src/components/auth/RequireAgencyAuth.tsx`
- `src/components/auth/RequireClientAuth.tsx`
- `src/components/auth/MagicLinkForm.tsx` — shared form fragment
- `src/components/auth/AuthErrorMessage.tsx` — Spanish-mapped error display
- `src/hooks/useUserContext.ts` — fetches `workspace_members` + `client_users` for current user, with React Query caching
- `docs/migrations/002_workspace_onboarding.sql` — adds `services jsonb`, `onboarded_at timestamptz`, `trial_ends_at timestamptz` to `workspaces`; creates `workspace-logos` storage bucket + RLS; creates `create_workspace(_name text, _slug text)` SECURITY DEFINER RPC

## Files to edit

- `src/App.tsx` — add `/forgot-password` alias, `/onboarding`, `/portal/:slug`, `/portal/select` (chooser), swap guards
- `src/pages/Login.tsx` — add magic-link toggle, loading states, Spanish error mapping
- `src/pages/Signup.tsx` — new headline, agency name field, post-signup workspace creation via RPC, redirect to `/onboarding`
- `src/pages/ResetPassword.tsx` — keep (handles recovery landing & new password set)
- `src/pages/portal/Login.tsx` — add magic-link toggle, redirect by client slug or to chooser
- `src/components/require-auth.tsx` — keep as base or remove (replaced by role-aware guards)
- `src/components/user-menu.tsx` (and portal equivalent) — wire up logout
- `tailwind.config.ts` / `src/index.css` — ensure Mulish is loaded

## Storage bucket — `workspace-logos`

- Public read (logos are not sensitive and may render on unauthenticated pages later)
- Write: only `workspace_members` with role `owner` of the matching workspace. Path convention: `/{workspace_id}/logo.{ext}`
- Max file size 2 MB, allowed types: `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`

## Required user actions after I implement

1. Run `docs/migrations/002_workspace_onboarding.sql` in the Supabase SQL editor.
2. In Supabase dashboard → Auth → URL Configuration, add redirect URLs:
  - `{origin}/reset-password`
  - `{origin}/app/dashboard`
  - `{origin}/portal`
3. Enable **Email** provider (already default) and confirm magic links are allowed.
4. **Heads up on email rate limits**: default Supabase email service caps at 4 emails/hour during dev. For real beta with 180 Grados, configure custom SMTP (Resend) before inviting users.

## Verification after apply

1. **Signup smoke test**: create a brand new user → confirm `auth.users` row, `profiles` row, `workspaces` row with `trial_ends_at = now() + 14 days`, and `workspace_members` row with `role = owner` all exist.
2. **Magic link flow**: request magic link → confirmation screen renders → email arrives → click link → land on `/app/dashboard` (or `/onboarding` if first time).
3. **Onboarding gate**: a fresh signup must be redirected to `/onboarding` until `onboarded_at` is set.
4. **Cross-realm redirect**: an agency-only user hitting `/portal/{slug}` → redirected to `/login`. A client-only user hitting `/app/dashboard` → redirected to `/portal/login`.
5. **Dual-role banner**: manually insert a `client_users` row for an existing agency owner → confirm banner appears in `/app/dashboard` offering switch.
6. **Logout**: click logout → session cleared → redirected to correct login page.
7. **Storage RLS**: confirm a non-owner of a workspace cannot upload to `workspace-logos/{other_workspace_id}/`.

## Out of scope / clarification

- The original request mentions Next.js middleware and routes like `/dashboard`, `/clients`, `/projects`, etc. This project uses Vite + React Router with the `/app/*` prefix already wired (`/app/dashboard`, `/app/clientes`, …). **Confirmed: keep** `/app/*` **prefix** for future subdomain split.
- No subdomain split (`app.` vs `portal.`) yet — both live under one origin with `/portal` prefix.
- Custom SMTP via Resend — out of scope for this iteration, flagged as required before pilot launch with 180 Grados.

Approve and I'll implement.