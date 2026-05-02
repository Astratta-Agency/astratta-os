-- Astratta OS — Cross-tenant RLS regression smoke tests.
-- Run as authenticated users via PostgREST (or psql with auth.uid() set).
-- Reference assertions, not automated tests.

-- T1: cross-workspace isolation
--   userB (member of W2 only):
--   SELECT * FROM clients WHERE workspace_id = '<W1>';
--   Expected: 0 rows.

-- T2: client_user scoping
--   client_user attached to C1 (workspace W1):
--   SELECT * FROM clients WHERE id = '<C2>';
--   Expected: 0 rows even when C2 is in W1.

-- T3: collaborator cannot delete clients
--   As collaborator on W1:
--   DELETE FROM clients WHERE id = '<C1>';
--   Expected: 0 rows affected.

-- T4: portal "Tu equipo en Astratta"
--   client_user of C1 SELECT profiles WHERE id = '<team_member of W1>' → 1 row.
--   Same client_user SELECT profiles WHERE id = '<user outside W1>'    → 0 rows.

-- T5: workspace owner bootstrap
--   INSERT INTO workspaces (name, slug, created_by) VALUES (...);
--   Expect workspace_members row with role='owner', status='active'.

-- T6: tasks not exposed to portal
--   client_user SELECT * FROM tasks WHERE client_id = '<C1>' → 0 rows.

-- T7: slug helper
--   SELECT public.generate_slug('180 Grados Med Spa!'); -- '180-grados-med-spa'
--   SELECT public.generate_slug('  Hello   World  ');   -- 'hello-world'
