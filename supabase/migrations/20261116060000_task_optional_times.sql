-- Optional time of day for a task's start and due dates.
-- start_date / due_date stay `date` (sorting, overdue checks and the Google
-- Calendar sync keep working unchanged); the time is an optional extra.
-- Additive nullable columns on an existing table: existing RLS and grants
-- already cover them.

alter table public.tasks
  add column if not exists start_time time,
  add column if not exists due_time time;

-- A time without its date makes no sense.
alter table public.tasks
  add constraint tasks_start_time_needs_date_chk check (start_time is null or start_date is not null),
  add constraint tasks_due_time_needs_date_chk check (due_time is null or due_date is not null);
