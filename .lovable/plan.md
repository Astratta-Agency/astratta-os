## Goal

Bring the existing agency shell up to spec with **minimal scope**: fix sidebar widths, sidebar footer with Configuración + user menu, label rename, icon swaps. Keep current design tokens (sidebar `#0a0a0a`, `#1a1a1a` hover, orange `#ff7503` active accent bar, primary `#5140f2`).

**Defer for later iterations** (out of scope right now): GlobalSearch and QuickActionsMenu — these only make sense once we have data to search and modals to open. We'll add them when we build the CRM and content calendar modules.

## Changes

### 1. `src/components/ui/sidebar.tsx` — widths

Update three constants so the sidebar matches the spec without touching the rest of the primitive:

- `SIDEBAR_WIDTH` `"16rem"` → `"260px"`
- `SIDEBAR_WIDTH_ICON` `"3rem"` → `"64px"`
- `SIDEBAR_WIDTH_MOBILE` stays `"18rem"` (drawer)

Mobile drawer behavior is already built-in (uses `Sheet` under `useIsMobile`), so no extra wiring needed.

### 2. `src/components/app-sidebar.tsx` — items, icons, footer

- Swap icons: `Proyectos` → `Briefcase`, `Calendario` → `CalendarDays` (others already correct).
- Rename label to "Calendario de contenido".
- Keep order: Dashboard, Clientes, Proyectos, Calendario de contenido, Tareas, Finanzas, Reportes.
- In `SidebarFooter`: render Configuración menu item, then a `<SidebarSeparator />`, then a new `<SidebarUserMenu />` block (avatar + name/email + chevron) that opens a `DropdownMenu` with: Mi perfil, Cambiar workspace, Cerrar sesión. Collapses to avatar-only when sidebar is icon-collapsed.
- Active state: existing left orange bar already works; verify width is 3px (it is: `w-[3px]`).

### 3. `src/components/sidebar-user-menu.tsx` (new)

Thin wrapper that reuses logic from existing `UserMenu`: pulls `user` from `useAuth`, derives initials, exposes Profile / Switch workspace / Logout. Visually styled for dark sidebar (white text, `#1a1a1a` hover via `hover:bg-sidebar-accent`).

### 4. `src/components/top-bar.tsx` — minor polish only

- Set top bar height to `h-[60px]` (currently `h-16` = 64px) and bottom border `border-border` (already `#eaeaea` via token).
- Keep existing `WorkspaceSwitcher`, `UserMenu`, notifications button as they are.
- **DO NOT add GlobalSearch or QuickActionsMenu in this iteration.** Reserve a centered empty slot in the topbar layout where GlobalSearch will go later (`<div className="flex-1" />` placeholder is fine).
- Note: keeping `UserMenu` in both the top bar and the sidebar footer is intentional (common SaaS pattern); we'll reduce duplication later if it feels redundant during real use.

Note: keeping `UserMenu` in the top bar in addition to the sidebar footer is acceptable (common pattern). If the user wants it removed from the top bar, that's a one-line follow-up.

### 5. **Layout polish —** `src/layouts/AppShell.tsx`

No structural changes; verify content area uses `flex-1` and `min-w-0` so the 260px sidebar leaves the rest of the viewport for content (already the case).

#### Technical notes

- All icons from `lucide-react`: `LayoutDashboard, Users, Briefcase, CalendarDays, CheckSquare, DollarSign, BarChart3, Settings, Bell`.
- shadcn primitives used: `Sidebar*`, `Sheet` (via Sidebar mobile), `Avatar`, `DropdownMenu`, `Button`.
- Colors come from existing tokens — no new tokens needed.
- Active item already renders `bg-sidebar-accent` + 3px `bg-secondary` left bar; keep that.
- Mobile: `useIsMobile` (<768px) automatically swaps the sidebar for a `Sheet`-based drawer; `SidebarTrigger` in the top bar opens it.

## Technical notes

- All icons from `lucide-react`: `LayoutDashboard, Users, Briefcase, CalendarDays, CheckSquare, DollarSign, BarChart3, Settings, Bell`.
- shadcn primitives used: `Sidebar*`, `Sheet` (via Sidebar mobile), `Avatar`, `DropdownMenu`, `Button`.
- Colors come from existing tokens — no new tokens needed.
- Active item already renders `bg-sidebar-accent` + 3px `bg-secondary` left bar; keep that.
- Mobile: `useIsMobile` (<768px) automatically swaps the sidebar for a `Sheet`-based drawer; `SidebarTrigger` in the top bar opens it.

## Out of scope (later iterations)

- **GlobalSearch with** `CommandDialog` — defer until we have CRM clients, projects, and posts to search across. Building empty search UI now is wasted work.
- **QuickActionsMenu with** `+` **icon** — defer until each module has its create modal (Nuevo cliente modal in CRM module, Nuevo proyecto modal in Projects, etc.). Once at least 2 modals exist, we'll add the global quick-actions trigger and wire them.
- Wiring real workspace switching (currently a placeholder).
- Notification feed (badge is currently static).  
  
Approve and I'll implement the trimmed scope.