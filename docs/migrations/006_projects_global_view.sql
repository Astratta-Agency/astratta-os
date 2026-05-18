-- 006_projects_global_view.sql
-- Phase 3: Global Projects cockpit at /app/proyectos

alter table public.projects
  add column if not exists assigned_team_ids jsonb not null default '[]'::jsonb;

create index if not exists idx_projects_ws_status_end
  on public.projects (workspace_id, status, end_date);

create index if not exists idx_projects_assigned_team_gin
  on public.projects using gin (assigned_team_ids);
