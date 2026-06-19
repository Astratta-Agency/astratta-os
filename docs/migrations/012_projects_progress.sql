-- Add manual progress override for projects (0–100). NULL means "use computed progress".
alter table public.projects
  add column if not exists progress smallint
    check (progress is null or (progress >= 0 and progress <= 100));
