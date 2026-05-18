-- 007_social_posts_calendar_fields.sql
-- Adds calendar UX fields to social_posts and introduces content_pillars.
-- Apply manually in Supabase SQL Editor.

-- ============================================================
-- social_posts: calendar fields
-- ============================================================
alter table public.social_posts add column if not exists channels text[] not null default '{}';
alter table public.social_posts add column if not exists content_pillar text;
alter table public.social_posts add column if not exists media_urls text[] not null default '{}';
alter table public.social_posts add column if not exists hashtags text;

create index if not exists idx_social_posts_client_scheduled
  on public.social_posts (client_id, scheduled_for);
create index if not exists idx_social_posts_workspace_status_scheduled
  on public.social_posts (workspace_id, status, scheduled_for);
create index if not exists idx_social_posts_channels_gin
  on public.social_posts using gin (channels);

-- ============================================================
-- content_pillars
-- ============================================================
create table if not exists public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  color text default '#5140f2',
  description text,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (client_id, name)
);

create index if not exists idx_content_pillars_client_order
  on public.content_pillars (client_id, sort_order);

alter table public.content_pillars enable row level security;

drop policy if exists pillars_select on public.content_pillars;
create policy pillars_select on public.content_pillars
  for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and (
          public.is_workspace_member(c.workspace_id)
          or public.is_client_user(c.id)
        )
    )
  );

drop policy if exists pillars_insert on public.content_pillars;
create policy pillars_insert on public.content_pillars
  for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists pillars_update on public.content_pillars;
create policy pillars_update on public.content_pillars
  for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists pillars_delete on public.content_pillars;
create policy pillars_delete on public.content_pillars
  for delete to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content_pillars.client_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- Seed default pillars for "180 Grados Med Spa" if present
-- ============================================================
do $$
declare
  v_client_id uuid;
begin
  select id into v_client_id
  from public.clients
  where slug = '180-grados-med-spa'
  limit 1;

  if v_client_id is not null then
    insert into public.content_pillars (client_id, name, color, description, sort_order) values
      (v_client_id, 'Educativo',         '#5140f2', 'Información sobre tratamientos, cuidados, beneficios',     1),
      (v_client_id, 'Antes/Después',     '#ff7503', 'Resultados con disclaimer FTC y consentimiento firmado',   2),
      (v_client_id, 'Testimonios',       '#10b981', 'Reseñas y experiencias con consentimiento',                3),
      (v_client_id, 'Behind-the-scenes', '#3b82f6', 'Equipo, instalaciones, día a día del spa',                 4),
      (v_client_id, 'Promociones',       '#f59e0b', 'Ofertas, paquetes, eventos especiales',                    5)
    on conflict (client_id, name) do nothing;
  end if;
end $$;
