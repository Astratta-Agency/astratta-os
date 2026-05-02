# Astratta OS — Foundational Schema (Migration 001)

This plan provisions the multi-tenant core in Lovable Cloud (Supabase under the hood) with strict, recursion-safe Row Level Security. Every table has RLS on, with separate policy paths for **agency members** and **client portal users**.

## Architectural decisions

1. **Two access realms, one database.** Agency staff access via `workspace_members`. Clients access the portal via `client_users`. Policies branch on which realm the caller belongs to — never both.
2. **All membership/role checks go through `SECURITY DEFINER` helper functions.** This is mandatory: a policy on `workspace_members` that re-queries `workspace_members` causes infinite recursion. Helpers are marked `STABLE`, owned by `postgres`, and pinned to `search_path = public, pg_temp`.
3. **Profiles table added** (`profiles`, mirrors `auth.users`) so we can join names/avatars in UI without exposing `auth.users`. Auto-populated via `on_auth_user_created` trigger. *(Small addition beyond the brief; needed for any UI that shows assignees.)*
4. **Roles stored only in `workspace_members.role` and `client_users.role**` — never on profiles. This matches Lovable's RBAC guidance.
5. **Generated types** are produced automatically by Lovable Cloud after the migration applies (`src/integrations/supabase/types.ts`). The hand-written client at `src/integrations/supabase/client.ts` will be updated to import the generated `Database` type so all queries become typed.
6. Brand fields live on `clients` (logo + colors) so the client portal can theme dynamically per tenant. Defaults match Astratta brand.

## Enums to create

```text
subscription_status : trialing | active | past_due | canceled
workspace_role      : owner | team_member | collaborator
member_status       : active | invited | suspended
client_status       : prospect | active | paused | churned
client_user_role    : client_admin | client_viewer
project_type        : web_dev | social_media | paid_ads | graphic_design | branding | audit
project_status      : planning | in_progress | paused | delivered | closed
task_status         : todo | doing | review | done
task_priority       : p0 | p1 | p2 | p3
```

## Tables

All tables get `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, and (where listed) `updated_at timestamptz default now()` with a shared `set_updated_at()` BEFORE UPDATE trigger.

```text
workspaces           — exactly per spec
workspace_members    — unique(workspace_id, user_id); index on user_id
profiles             — id (= auth.users.id), full_name, avatar_url, email
clients              — per spec; unique(workspace_id, slug); health_score CHECK 0..100
client_contacts      — per spec; index on client_id
client_users         — unique(client_id, user_id); index on user_id
projects             — per spec; CHECK end_date >= start_date
tasks                — per spec; related_post_id stays nullable (social_posts comes later)
```

`workspaces.slug` gets a unique index. FKs cascade on workspace/client delete so a workspace teardown is clean.

## Brand fields on `clients`

Add to `clients` table for portal theming per tenant:

```text
brand_primary_color   text  DEFAULT '#5140f2'
brand_secondary_color text  DEFAULT '#ff7503'
logo_url              text  NULL
```

## Defaults and CHECK constraints

```text
clients.status            DEFAULT 'prospect'
clients.health_score      CHECK (health_score >= 0 AND health_score <= 100)
projects.status           DEFAULT 'planning'
projects.retainer_monthly DEFAULT false
projects.budget_amount    CHECK (budget_amount IS NULL OR budget_amount >= 0)
projects                  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
tasks.status              DEFAULT 'todo'
tasks.priority            DEFAULT 'p2'
```

## Performance indexes (created with the migration)

```text
idx_clients_workspace_status         on clients (workspace_id, status)
idx_projects_workspace_client_status on projects (workspace_id, client_id, status)
idx_projects_client                  on projects (client_id)
idx_tasks_workspace_status_due       on tasks (workspace_id, status, due_date)
idx_tasks_assigned_status            on tasks (assigned_to, status)
idx_workspace_members_user_workspace on workspace_members (user_id, workspace_id)
idx_client_users_user_client         on client_users (user_id, client_id)
```

## Helper functions

### Security definer helpers (RLS, recursion-safe)

```text
is_workspace_member(_workspace_id uuid)              → boolean
has_workspace_role(_workspace_id uuid, _role workspace_role) → boolean
is_workspace_owner(_workspace_id uuid)               → boolean
is_client_user(_client_id uuid)                      → boolean
is_client_admin(_client_id uuid)                     → boolean
client_belongs_to_member_workspace(_client_id uuid)  → boolean
```

All take `auth.uid()` implicitly, are `SECURITY DEFINER STABLE`, and live in `public`.

## Slug helper

A non-security utility for app-side and trigger use:

```text
generate_slug(_input text) → text
```

- Lowercases input
- Replaces non-alphanumeric runs with single hyphens
- Trims leading/trailing hyphens
- Collapses duplicate hyphens
- Returns deterministic slug (e.g. `"180 Grados Med Spa!" → "180-grados-med-spa"`)

Marked `IMMUTABLE`. Used as default candidate when the application doesn't supply a slug for `clients.slug` or `workspaces.slug`. App layer can still override.

## RLS policy summary

For every table: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` (so even table owners obey policies via PostgREST).

```text
workspaces
  SELECT  : is_workspace_member(id)
  UPDATE  : is_workspace_owner(id)
  INSERT  : auth.uid() IS NOT NULL  (creator becomes owner via trigger)
  DELETE  : is_workspace_owner(id)

workspace_members
  SELECT  : is_workspace_member(workspace_id)
            OR user_id = auth.uid()           -- self-row, needed to bootstrap helper
  INSERT/UPDATE/DELETE : is_workspace_owner(workspace_id)

profiles
  SELECT  : id = auth.uid()
            OR EXISTS shared workspace via helper
            OR EXISTS (
                 SELECT 1 FROM client_users cu
                 JOIN clients c ON c.id = cu.client_id
                 JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
                 WHERE cu.user_id = auth.uid()
                   AND wm.user_id = profiles.id
               )                              -- portal "Tu equipo en Astratta"
  UPDATE  : id = auth.uid()

clients
  SELECT  : is_workspace_member(workspace_id)
            OR is_client_user(id)             -- portal read of own client
  INSERT/UPDATE/DELETE : is_workspace_member(workspace_id)
                         AND role in (owner, team_member)

client_contacts
  SELECT  : agency member of client's workspace
            OR client_user of this client
  WRITE   : agency member (team_member+)

client_users
  SELECT  : agency member of client's workspace
            OR user_id = auth.uid()           -- self
  WRITE   : agency member (team_member+)

projects
  SELECT  : is_workspace_member(workspace_id)
            OR is_client_user(client_id)
  WRITE   : is_workspace_member(workspace_id) AND role in (owner, team_member)

tasks
  SELECT  : is_workspace_member(workspace_id) -- internal only, NOT exposed to portal
  WRITE   : is_workspace_member(workspace_id)
            AND (assigned_to = auth.uid() OR role in (owner, team_member))
```

Collaborators (freelancers) get read-everywhere within the workspace but only write on tasks assigned to them and on their own task updates. Owners + team_members are the writers for clients/projects.

## Triggers

```text
set_updated_at()       → BEFORE UPDATE on workspaces, clients, projects, tasks
handle_new_user()      → AFTER INSERT on auth.users → inserts profile row
handle_new_workspace() → AFTER INSERT on workspaces → inserts workspace_members
                          row (creator, role=owner, status=active)
```

The workspace-creation trigger is what makes the `INSERT` policy on `workspaces` safe: the creator is auto-promoted to owner so subsequent SELECT/UPDATE policies see them.

## TypeScript / app integration

1. Lovable Cloud regenerates `src/integrations/supabase/types.ts` from the live schema after migration. No hand-written type file.
2. Update `src/integrations/supabase/client.ts` to:
  ```ts
   import type { Database } from "./types";
   createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { ... })
  ```
3. No UI wiring in this step — pages stay as placeholders. Hooking the sidebar/workspace switcher to real data is the **next** iteration.

## Files changed

```text
supabase/migrations/<timestamp>_astratta_core_schema.sql   (new — full migration)
src/integrations/supabase/types.ts                         (regenerated)
src/integrations/supabase/client.ts                        (typed Database)
docs/security-tests.sql                                    (new — regression smoke tests)
docs/decisions.md                                          (append schema decisions)
```

## Out of scope (future migrations)

- `social_posts`, `content_calendar`, approvals (referenced by `tasks.related_post_id` but not yet created)
- Finance: invoices, expenses, time entries
- Reports / analytics snapshots
- Storage buckets and signed-URL policies for `logo_url` uploads
- Audit log table
- Med-spa specifics: `disclaimers`, `media_assets` consent flag

## Verification after apply

- Run `security--run_security_scan` to confirm RLS is enabled on every new table and no policy is missing.
- Cross-tenant isolation smoke tests (save in `/docs/security-tests.sql` for regression):
  - **Test 1**: User A creates workspace W1 + client C1. User B creates workspace W2 + client C2. Confirm User B cannot SELECT C1 from clients table.
  - **Test 2**: A client_user attached to C1 cannot SELECT C2 even when C1 and C2 belong to the same workspace.
  - **Test 3**: A collaborator on W1 cannot DELETE clients (only read).
  - **Test 4**: A client_user can SELECT profiles of agency team_members in their workspace (needed for portal "Tu equipo en Astratta") but cannot SELECT profiles of users outside that workspace.
- Confirm `generate_slug('180 Grados Med Spa!')` returns `'180-grados-med-spa'`.
- Confirm a freshly inserted workspace auto-creates a `workspace_members` row with `role = owner`.

Approve to apply the migration and regenerate types.