-- 004_client_user_invites.sql
-- Allow pending portal invites in client_users.

alter table public.client_users
  alter column user_id drop not null;

alter table public.client_users
  add column if not exists status text not null default 'active'
    check (status in ('invited', 'active', 'revoked')),
  add column if not exists invited_email text,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists welcome_message text,
  add column if not exists invited_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists accepted_at timestamptz;

-- Backfill: existing rows are active
update public.client_users
set status = 'active'
where status is null or (user_id is not null and status = 'active');

-- Prevent duplicate pending invites for same email per client
create unique index if not exists idx_client_users_unique_pending_invite
  on public.client_users (client_id, lower(invited_email))
  where status = 'invited';

-- Either user_id is set OR invited_email is set
alter table public.client_users
  drop constraint if exists client_users_user_or_email_check;
alter table public.client_users
  add constraint client_users_user_or_email_check
  check (user_id is not null or invited_email is not null);
