create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  interest_tag text,
  source_page text,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (workspace_id, email)
);

create index subscribers_workspace_status_idx on public.subscribers (workspace_id, status);
create index subscribers_unsubscribe_token_idx on public.subscribers (unsubscribe_token);

alter table public.subscribers enable row level security;

create policy subscribers_select on public.subscribers
  for select using (is_workspace_member(workspace_id));

create policy subscribers_insert on public.subscribers
  for insert with check (is_workspace_member(workspace_id));

create policy subscribers_update on public.subscribers
  for update using (is_workspace_member(workspace_id));

create policy subscribers_delete on public.subscribers
  for delete using (is_workspace_owner(workspace_id));
