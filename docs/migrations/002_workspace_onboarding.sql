-- =====================================================================
-- Astratta OS — Migration 002: Workspace onboarding + create_workspace RPC
-- Apply in your Supabase project (SQL Editor or `supabase db push`).
-- =====================================================================

-- ---------- Schema additions on workspaces ---------------------------
alter table public.workspaces
  add column if not exists services jsonb not null default '[]'::jsonb,
  add column if not exists onboarded_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists website text,
  add column if not exists location text not null default 'Dallas-Fort Worth, TX';

-- Backfill trial_ends_at for any existing rows.
update public.workspaces
   set trial_ends_at = coalesce(trial_ends_at, created_at + interval '14 days');

-- ---------- create_workspace RPC -------------------------------------
-- Wraps insert + slug uniqueness + trial defaults. Owner membership
-- is auto-created by trg_workspaces_owner_bootstrap (migration 001).
create or replace function public.create_workspace(_name text, _slug text default null)
returns public.workspaces
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid uuid := auth.uid();
  _base_slug text;
  _final_slug text;
  _i int := 0;
  _row public.workspaces;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  _base_slug := nullif(public.generate_slug(coalesce(_slug, _name)), '');
  if _base_slug is null then
    _base_slug := 'workspace';
  end if;

  _final_slug := _base_slug;
  while exists (select 1 from public.workspaces w where w.slug = _final_slug) loop
    _i := _i + 1;
    _final_slug := _base_slug || '-' || _i::text;
  end loop;

  insert into public.workspaces (
    name, slug, billing_email, created_by,
    subscription_status, trial_ends_at
  ) values (
    _name, _final_slug,
    (select email from auth.users where id = _uid),
    _uid,
    'trialing', now() + interval '14 days'
  )
  returning * into _row;

  return _row;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;

-- ---------- Storage: workspace-logos bucket --------------------------
insert into storage.buckets (id, name, public)
values ('workspace-logos', 'workspace-logos', true)
on conflict (id) do update set public = excluded.public;

-- Public read
drop policy if exists "workspace-logos public read" on storage.objects;
create policy "workspace-logos public read"
on storage.objects for select
using (bucket_id = 'workspace-logos');

-- Owners can write to their own workspace folder ({workspace_id}/...)
drop policy if exists "workspace-logos owner write" on storage.objects;
create policy "workspace-logos owner write"
on storage.objects for insert
with check (
  bucket_id = 'workspace-logos'
  and exists (
    select 1 from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.role = 'owner'
      and wm.status = 'active'
      and wm.workspace_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "workspace-logos owner update" on storage.objects;
create policy "workspace-logos owner update"
on storage.objects for update
using (
  bucket_id = 'workspace-logos'
  and exists (
    select 1 from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.role = 'owner'
      and wm.workspace_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "workspace-logos owner delete" on storage.objects;
create policy "workspace-logos owner delete"
on storage.objects for delete
using (
  bucket_id = 'workspace-logos'
  and exists (
    select 1 from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.role = 'owner'
      and wm.workspace_id::text = (storage.foldername(name))[1]
  )
);
