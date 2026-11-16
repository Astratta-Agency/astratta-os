-- Optional start date for tasks (ClickUp-style "Inicio → Fin" range).
-- Additive, nullable column on an existing table: no new RLS/grants needed
-- (existing tasks policies and grants already cover it).

alter table public.tasks
  add column if not exists start_date date;

alter table public.tasks
  add constraint tasks_start_before_due_chk
  check (start_date is null or due_date is null or start_date <= due_date);
