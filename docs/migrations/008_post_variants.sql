-- Phase 4.2 — Post variants for multi-channel editor
-- Apply via Supabase SQL editor.

create table if not exists public.post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  channel text not null check (channel in ('instagram','facebook','linkedin','tiktok','x','threads')),
  caption text not null default '',
  hashtags text default '',
  first_comment text default '',
  mentions text[] not null default '{}',
  location text,
  utm_url text,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (post_id, channel)
);

create index if not exists idx_post_variants_post on public.post_variants (post_id);
create index if not exists idx_post_variants_mentions_gin on public.post_variants using gin (mentions);

alter table public.post_variants enable row level security;

drop policy if exists post_variants_select on public.post_variants;
create policy post_variants_select on public.post_variants
  for select to authenticated
  using (
    exists (
      select 1 from public.social_posts sp
      join public.clients c on c.id = sp.client_id
      where sp.id = post_variants.post_id
        and (
          public.is_workspace_member(c.workspace_id)
          or (
            public.is_client_user(c.id)
            and sp.status in ('pending_approval','approved','rejected','scheduled','published')
          )
        )
    )
  );

drop policy if exists post_variants_write on public.post_variants;
create policy post_variants_write on public.post_variants
  for all to authenticated
  using (
    exists (
      select 1 from public.social_posts sp
      join public.clients c on c.id = sp.client_id
      where sp.id = post_variants.post_id
        and public.is_workspace_member(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.social_posts sp
      join public.clients c on c.id = sp.client_id
      where sp.id = post_variants.post_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

create or replace function public.set_post_variants_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;

drop trigger if exists trg_post_variants_set_updated on public.post_variants;
create trigger trg_post_variants_set_updated
  before update on public.post_variants
  for each row execute function public.set_post_variants_updated_at();

-- Expand social_posts.type check
alter table public.social_posts drop constraint if exists social_posts_type_check;
alter table public.social_posts add constraint social_posts_type_check
  check (type in ('feed_post','carousel','reel','story','video','other'));

-- Format-specific metadata (used in 4.3+)
alter table public.social_posts
  add column if not exists format_meta jsonb not null default '{}'::jsonb;
