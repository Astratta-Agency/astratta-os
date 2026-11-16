-- Minimal stand-in for the parts of Supabase the migrations depend on, so the
-- real migrations can run inside PGlite (plain Postgres, no Docker).
--
-- This is NOT a security model: it only has to make the migrations apply and
-- make auth.uid()/auth.role() behave like PostgREST does. RLS itself is the
-- real thing, defined by the migrations under test.

-- ---------------------------------------------------------------- roles
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- Supabase grants new public objects to these roles by default. Migrations
-- written before 2026-10-30 rely on that, so reproduce it.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- extensions
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Same contract as PostgREST: the request's JWT claims arrive as GUCs.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- ---------------------------------------------------------------- vault (no real encryption)
create schema vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  key_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, created_at, updated_at
  from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null,
                                    new_description text default '', new_key_id uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into vault.secrets (secret, name, description, key_id)
  values (new_secret, new_name, coalesce(new_description, ''), new_key_id) returning id into v_id;
  return v_id;
end $$;
create function vault.update_secret(secret_id uuid, new_secret text default null,
                                    new_name text default null, new_description text default null,
                                    new_key_id uuid default null)
returns void language sql as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
         description = coalesce(new_description, description), updated_at = now()
  where id = secret_id
$$;

-- ---------------------------------------------------------------- pg_cron / pg_net (no-ops)
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text, active boolean default true);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid
$$;
create function cron.unschedule(job_name text) returns boolean language sql as $$
  delete from cron.job where jobname = job_name returning true
$$;

create schema net;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                              headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
                              timeout_milliseconds integer default 5000)
returns bigint language sql as $$ select 0::bigint $$;

-- ---------------------------------------------------------------- storage
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
