-- Docs (ClickUp-style): subpages, icon, cover, archive and per-user favorites.

-- 1. New columns on documents (existing RLS and grants already cover them) ----

alter table public.documents
  add column if not exists parent_id uuid references public.documents(id) on delete cascade,
  add column if not exists icon text,
  add column if not exists cover_color text,
  add column if not exists archived_at timestamptz,
  add column if not exists position integer not null default 0;

alter table public.documents
  add constraint documents_not_own_parent_chk check (parent_id is null or parent_id <> id),
  add constraint documents_icon_len_chk check (icon is null or char_length(icon) <= 16),
  add constraint documents_cover_color_chk check (cover_color is null or cover_color ~ '^#[0-9a-fA-F]{6}$');

create index if not exists documents_parent_idx on public.documents (parent_id);

-- A subpage must live in the same workspace as its parent.
create or replace function public.tg_documents_parent_same_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.documents p
    where p.id = new.parent_id and p.workspace_id = new.workspace_id
  ) then
    raise exception 'parent document must belong to the same workspace';
  end if;
  return new;
end $$;

drop trigger if exists documents_parent_same_workspace on public.documents;
create trigger documents_parent_same_workspace
before insert or update of parent_id, workspace_id on public.documents
for each row execute function public.tg_documents_parent_same_workspace();

-- 2. Favorites (per user) ------------------------------------------------------

create table public.document_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create index document_favorites_doc_idx on public.document_favorites (document_id);

alter table public.document_favorites enable row level security;

create policy document_favorites_select_own on public.document_favorites
  for select
  using (user_id = (select auth.uid()));

create policy document_favorites_insert_own on public.document_favorites
  for insert
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.workspace_id = document_favorites.workspace_id
    )
  );

create policy document_favorites_delete_own on public.document_favorites
  for delete
  using (user_id = (select auth.uid()));

-- Grants (required since 2026-10-30, see docs/database.md). No update: a
-- favorite is only added or removed.
grant select, insert, delete on public.document_favorites to authenticated;
grant select, insert, update, delete on public.document_favorites to service_role;
