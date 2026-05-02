# Astratta OS — Shell Setup

Build the auth-gated app shell for Astratta OS on the Lovable stack (React 18 + Vite + TypeScript, Tailwind, shadcn/ui). No features yet — just the skeleton, design system, and routing, ready to layer functionality onto.

> Note on framework: Lovable runs React + Vite, not Next.js. All other pieces from your spec (Tailwind, shadcn/ui, Supabase, Stripe, Resend, design tokens, multi-tenant model) are fully supported. Routing will use react-router-dom instead of App Router.

## 1. Design system

Apply the Astratta brand tokens globally so every component inherits them.

- **Colors** (HSL in `index.css`, semantic tokens in `tailwind.config.ts`):
  - `--primary`: #5140f2 (electric purple)
  - `--secondary`: #ff7503 (vibrant orange)
  - `--background`: #ffffff, `--card`/`--muted`: #fafafa
  - `--foreground`: #0a0a0a, `--muted-foreground`: #525252
  - `--border`: #eaeaea
  - `--sidebar-bg`: `#0a0a0a`
  - `--sidebar-fg`: `#ffffff`
  - `--sidebar-muted`: `#a1a1aa`
  - `--sidebar-hover`: `#1a1a1a`
  - `--sidebar-active-accent`: `#ff7503`
- **Typography**: Mulish loaded from Google Fonts (weights 300/400/700). Set as default sans on body. H1 = Mulish Bold 32px; subtitle = Mulish Regular 16px text-muted-foreground.
- **Radius**: cards 12px, inputs/buttons 8px (via `--radius` + per-component overrides).
- **Shadow**: custom `shadow-subtle` = `0 1px 3px rgba(0,0,0,0.05)`.
- **Spacing**: section utility classes giving ≥24px rhythm.
- Update `src/components/ui/button.tsx` and `card.tsx` defaults to match the radius/shadow spec.
- All components must reference semantic tokens (`bg-background`, `text-foreground`, `bg-primary`) — no hardcoded hex in components.

## 2. App shell layout

A single agency-side shell with persistent navigation.

```text
┌──────────────────────────────────────────────────────┐
│ [Workspace ▾]            🔔   [Avatar ▾]              │  ← TopBar (h-16, bg-white, border-b)
├──────────┬───────────────────────────────────────────┤
│ Sidebar  │                                           │
│ (w-64,   │            <Outlet />                     │
│  dark)   │            page content                   │
│          │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

## Sidebar — dark style

- Built with shadcn `Sidebar` (`collapsible="icon"`).
- Background `#0a0a0a`, text white, secondary text `#a1a1aa`.
- **Astratta logo at the very top** (above nav items), 32px tall, white version (use `/public/logo-white.svg` placeholder if no asset).
- **Active item**: 3px left accent bar in `#ff7503` + background `#1a1a1a`.
- **Hover state**: background `#1a1a1a`, no other change.
- Active route highlighted via `NavLink` + `isActive`.
- `SidebarTrigger` lives in the TopBar so it stays visible when collapsed.
- Sidebar items (Spanish, in this order):
  1. Dashboard
  2. Clientes
  3. Proyectos
  4. Calendario
  5. Tareas
  6. Finanzas
  7. Reportes
  8. Configuración (rendered at the bottom, separated from main nav by a divider)

## TopBar — h-16, white, bottom border `#eaeaea`

- **Left**: workspace switcher rendered as a dropdown button — shows current workspace name + chevron-down icon, opens a dropdown menu. For now, hardcode "Astratta Agency" with no real switching logic, but render it as a `DropdownMenu` trigger so multi-workspace can be wired in later.
- **Center**: leave empty for now (global search reserved for a later iteration).
- **Right**: notifications bell icon (with placeholder badge, no logic), then user avatar dropdown with items: "Mi perfil", "Cerrar sesión".

## Mobile responsiveness

- Below `md` breakpoint, the Sidebar becomes a `Sheet` drawer.
- `SidebarTrigger` always visible in TopBar on mobile.
- All placeholder pages must be mobile-friendly out of the box (no horizontal scroll, padding reduces gracefully).

## 3. Routing & auth gating

Using `react-router-dom`. Two flows separated by route prefix today; ready to split into `app.*` / `portal.*` subdomains later via custom domain.

## Auth routes (stubs included so flows don't break later)

- `/login` — agency team login (email + password, Spanish copy).
- `/signup` — agency team signup (email + password + workspace name field, UI only for now, no DB write yet).
- `/reset-password` — agency password reset stub.
- `/portal/login` — client portal login.
- `/portal/forgot-password` — client portal password reset stub.

## Login page differentiation

- `/login` **(agency)**: darker, pro-tool feel — black accent bar on the left side of the auth card, headline "Bienvenida de vuelta", subheadline "Accede a tu workspace de Astratta OS". Link below form: "¿Aún no tienes cuenta? Crea tu workspace" → `/signup`.
- `/portal/login` **(client)**: lighter, premium-friendly — soft gradient background using `#fafafa` to `#ffffff`, headline "Accede al portal de tu agencia", subheadline "Tu agencia te invitó a colaborar aquí". Link below form: "¿Olvidaste tu contraseña?" → `/portal/forgot-password`.
- Both use Mulish, both centered card, primary CTA button in `#5140f2`.

## App routes

- `/app/*` — agency shell, gated by `RequireAuth`. Inside:
  - `/app/dashboard`, `/app/clientes`, `/app/proyectos`, `/app/calendario`, `/app/tareas`, `/app/finanzas`, `/app/reportes`, `/app/configuracion`
- `/portal/*` — client shell placeholder (empty for now, just routed).
- `/` redirects to `/app/dashboard` (or `/login` if signed out).
- `RequireAuth` uses Supabase `onAuthStateChange` (set up before `getSession()`) and renders a loading state while resolving.

Each placeholder page renders a consistent header (H1 in Mulish Bold + short Spanish caption) and an empty state card — no business logic.

## Placeholder pages — design-system showcase

Each page renders a consistent layout for visual validation from day one:

- H1 in Mulish Bold 32px (page name in Spanish)
- Subtitle in Mulish Regular 16px text-muted-foreground (short caption per module)
- Empty state card centered: small lucide icon (`Inbox` or module-relevant), text "Aún no hay datos en este módulo", subtext "Empieza configurando este módulo" — using semantic tokens

## Page subtitles:

- Dashboard: "Vista general de tu agencia"
- Clientes: "Gestiona todos tus clientes en un solo lugar"
- Proyectos: "Todos tus proyectos activos"
- Calendario: "Planifica y programa contenido"
- Tareas: "Lo que está pendiente y en progreso"
- Finanzas: "Facturas, pagos y márgenes"
- Reportes: "Reportes mensuales por cliente"
- Configuración: "Preferencias del workspace"

## 4. Supabase connection

## Bring-your-own Supabase project.

- Add a `Connect Supabase` step: paste the Project URL and anon public key; wire up `src/integrations/supabase/client.ts`.
- Auth methods enabled in this shell: Email + password only (matches the two-flow plan; social providers can be added later).
- No tables created yet — schema for workspaces, memberships, clients, etc. comes in the next iteration.

## 5. File structure

```text
src/
  main.tsx, App.tsx, index.css
  integrations/supabase/client.ts
  layouts/
    AppShell.tsx        ← sidebar + topbar + <Outlet/>
    PortalShell.tsx     ← placeholder
  components/
    app-sidebar.tsx
    top-bar.tsx
    workspace-switcher.tsx
    user-menu.tsx
    require-auth.tsx
    brand/Logo.tsx
    empty-state.tsx
  pages/
    Login.tsx
    Signup.tsx
    ResetPassword.tsx
    portal/Login.tsx
    portal/ForgotPassword.tsx
    app/Dashboard.tsx
    app/Clientes.tsx
    app/Proyectos.tsx
    app/Calendario.tsx
    app/Tareas.tsx
    app/Finanzas.tsx
    app/Reportes.tsx
    app/Configuracion.tsx
    NotFound.tsx
  hooks/useAuth.ts
docs/
  decisions.md          ← architectural decisions log
```

## What's intentionally out of scope (next iterations)

- Multi-tenant data model (workspaces, memberships, clients as sub-tenants, role table `app_role` with `has_role()` security-definer function).
- Client portal UI beyond the login stub.
- Stripe (subscriptions/invoicing) and Resend (transactional email).
- Any feature logic for content calendar, tasks, finance, reports.
- Global search in TopBar (placeholder slot reserved).
- Real notification logic (icon + badge are placeholders only).

## Technical details

- React 18 + Vite + TypeScript; Tailwind v3; shadcn/ui already scaffolded.
- Mulish via Google Fonts `<link>` in `index.html`; `font-family` set on `body` and Tailwind `fontFamily.sans` extended.
- All colors as HSL CSS variables; components reference semantic tokens.
- Roles will be stored in a dedicated `user_roles` table with a `has_role()` SECURITY DEFINER function (not on a profiles table) when we add the data layer — flagged here so the foundation is right.
- Subdomain split (`app.astrattaos.com` / `portal.astrattaos.com`) is deferred to the custom-domain step; route prefixes today make that swap trivial.
- `eslint-plugin-tailwindcss` configured with recommended rules to maintain class consistency.
- `/docs/decisions.md` is created and populated with each architectural decision made in this shell setup, so context survives across sessions.

After approval, implement the shell end-to-end and then prompt for the Supabase URL + anon key to finish the connection.