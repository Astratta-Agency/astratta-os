-- Planner: time blocks that schedule a task into someone's calendar
-- (ClickUp-style "drag a task onto the week").
--
-- A block belongs to one user (who will work on it) and one task. Every
-- workspace member can see the blocks of the workspace (to plan around
-- teammates); only the owner can create, move or delete their own blocks.

create table public.task_time_blocks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_time_blocks_range_chk check (ends_at > starts_at),
  constraint task_time_blocks_max_len_chk check (ends_at - starts_at <= interval '24 hours')
);

create index task_time_blocks_user_range_idx
  on public.task_time_blocks (workspace_id, user_id, starts_at);
create index task_time_blocks_task_idx on public.task_time_blocks (task_id);

-- RLS -------------------------------------------------------------------------

alter table public.task_time_blocks enable row level security;

create policy task_time_blocks_select_member on public.task_time_blocks
  for select
  using (public.is_workspace_member(workspace_id));

create policy task_time_blocks_insert_own on public.task_time_blocks
  for insert
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.workspace_id = task_time_blocks.workspace_id
    )
  );

create policy task_time_blocks_update_own on public.task_time_blocks
  for update
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.workspace_id = task_time_blocks.workspace_id
    )
  );

create policy task_time_blocks_delete_own on public.task_time_blocks
  for delete
  using (user_id = (select auth.uid()));

-- Grants (required since 2026-10-30, see docs/database.md) -------------------

grant select, insert, update, delete on public.task_time_blocks to authenticated;
grant select, insert, update, delete on public.task_time_blocks to service_role;
