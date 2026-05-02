-- Astratta OS — Cross-tenant RLS regression smoke tests.
-- Run as anon/authenticated via PostgREST or psql with auth.uid() set.
-- These are reference assertions, not automated tests.

-- T1: cross-workspace isolation
--   As userB (member of W2 only), SELECT * FROM clients WHERE workspace_id = W1
--   Expected: 0 rows.

-- T2: client_user scoping
--   client_user attached to C1 (workspace W1) cannot see C2 (also W1).
--   SELECT * FROM clients WHERE id = C2 → 0 rows.

-- T3: collaborator cannot delete
--   As collaborator on W1, DELETE FROM clients WHERE id = C1 → 0 rows affected.

-- T4: portal "Tu equipo en Astratta"
--   client_user of C1 SELECT * FROM profiles WHERE id = <agency team_member of W1>
--   Expected: 1 row.
--   Same client_user SELECT * FROM profiles WHERE id = <user outside W1>
--   Expected: 0 rows.

-- T5: workspace owner bootstrap
--   INSERT INTO workspaces (name, slug, created_by) VALUES (...)
--   Expected: corresponding workspace_members row with role='owner', status='active'.

-- T6: tasks not exposed to portal
--   client_user SELECT * FROM tasks WHERE client_id = C1 → 0 rows.

-- T7: slug helper determinism
--   SELECT public.generate_slug('180 Grados Med Spa!');  -- '180-grados-med-spa'
--   SELECT public.generate_slug('  Hello   World  ');    -- 'hello-world'
