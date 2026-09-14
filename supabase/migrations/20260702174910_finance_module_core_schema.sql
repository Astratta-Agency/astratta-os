-- ============================================================
-- Finanzas module — core schema (invoices, invoice_items, payments, expenses)
-- ============================================================

-- 0. Workspace-level invoicing defaults
alter table public.workspaces add column if not exists default_tax_rate numeric not null default 0;
alter table public.workspaces add column if not exists default_payment_terms_days integer not null default 15;
alter table public.workspaces add column if not exists invoice_notes_default text;

-- Stripe customer cache per client
alter table public.clients add column if not exists stripe_customer_id text;
create index if not exists idx_clients_stripe_customer_id on public.clients(stripe_customer_id);

-- ============================================================
-- 1. invoices
-- ============================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','partial','overdue','void')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'usd',
  subtotal numeric not null default 0,
  tax_rate numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  is_recurring boolean not null default false,
  recurrence_interval text check (recurrence_interval in ('monthly','quarterly','yearly')),
  notes text,
  terms text,
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_hosted_invoice_url text,
  stripe_invoice_pdf text,
  sent_at timestamptz,
  paid_at timestamptz,
  void_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);

create index idx_invoices_workspace_id on public.invoices(workspace_id);
create index idx_invoices_client_id on public.invoices(client_id);
create index idx_invoices_project_id on public.invoices(project_id);
create index idx_invoices_created_by on public.invoices(created_by);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_stripe_invoice_id on public.invoices(stripe_invoice_id);

create trigger set_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. invoice_items
-- ============================================================
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric generated always as (round(quantity * unit_price, 2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index idx_invoice_items_project_id on public.invoice_items(project_id);

-- ============================================================
-- 3. payments
-- ============================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric not null,
  currency text not null default 'usd',
  method text not null default 'stripe' check (method in ('stripe','ach','check','cash','wire','other')),
  status text not null default 'succeeded' check (status in ('pending','succeeded','failed','refunded')),
  stripe_payment_intent_id text,
  stripe_charge_id text,
  receipt_url text,
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_payments_workspace_id on public.payments(workspace_id);
create index idx_payments_invoice_id on public.payments(invoice_id);
create index idx_payments_client_id on public.payments(client_id);
create index idx_payments_created_by on public.payments(created_by);

-- ============================================================
-- 4. expenses
-- ============================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  category text not null check (category in ('ads_spend','software','contractor','other')),
  description text not null,
  amount numeric not null,
  currency text not null default 'usd',
  expense_date date not null default current_date,
  vendor text,
  is_billable boolean not null default false,
  receipt_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_expenses_workspace_id on public.expenses(workspace_id);
create index idx_expenses_project_id on public.expenses(project_id);
create index idx_expenses_client_id on public.expenses(client_id);
create index idx_expenses_created_by on public.expenses(created_by);

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create or replace function public.invoice_in_member_workspace(_invoice_id uuid)
returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.invoices i
    where i.id = _invoice_id and public.is_workspace_member(i.workspace_id)
  );
$$;

create or replace function public.invoice_can_write(_invoice_id uuid)
returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.invoices i
    where i.id = _invoice_id and public.can_write_workspace(i.workspace_id)
  );
$$;

revoke execute on function public.invoice_in_member_workspace(uuid) from public, anon;
grant execute on function public.invoice_in_member_workspace(uuid) to authenticated;
revoke execute on function public.invoice_can_write(uuid) from public, anon;
grant execute on function public.invoice_can_write(uuid) to authenticated;

create policy invoices_select on public.invoices for select
  using (is_workspace_member(workspace_id) or is_client_user(client_id));
create policy invoices_insert on public.invoices for insert
  with check (can_write_workspace(workspace_id));
create policy invoices_update on public.invoices for update
  using (can_write_workspace(workspace_id)) with check (can_write_workspace(workspace_id));
create policy invoices_delete on public.invoices for delete
  using (is_workspace_owner(workspace_id));

create policy invoice_items_select on public.invoice_items for select
  using (
    invoice_in_member_workspace(invoice_id)
    or exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and is_client_user(i.client_id))
  );
create policy invoice_items_insert on public.invoice_items for insert
  with check (invoice_can_write(invoice_id));
create policy invoice_items_update on public.invoice_items for update
  using (invoice_can_write(invoice_id)) with check (invoice_can_write(invoice_id));
create policy invoice_items_delete on public.invoice_items for delete
  using (invoice_can_write(invoice_id));

create policy payments_select on public.payments for select
  using (is_workspace_member(workspace_id) or is_client_user(client_id));
create policy payments_insert on public.payments for insert
  with check (can_write_workspace(workspace_id));
create policy payments_update on public.payments for update
  using (can_write_workspace(workspace_id)) with check (can_write_workspace(workspace_id));
create policy payments_delete on public.payments for delete
  using (is_workspace_owner(workspace_id));

create policy expenses_select on public.expenses for select
  using (is_workspace_member(workspace_id));
create policy expenses_insert on public.expenses for insert
  with check (can_write_workspace(workspace_id));
create policy expenses_update on public.expenses for update
  using (can_write_workspace(workspace_id)) with check (can_write_workspace(workspace_id));
create policy expenses_delete on public.expenses for delete
  using (is_workspace_owner(workspace_id));

-- ============================================================
-- 6. notifications: new types
-- ============================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'post_approved','post_rejected','post_changes_requested','invite_accepted',
    'payment_received','contract_expiring','new_lead','proposal_signed',
    'task_assigned','contract_signed',
    'invoice_sent','invoice_paid','invoice_overdue','invoice_payment_failed'
  ]));

-- ============================================================
-- 7. invoice numbering
-- ============================================================
create or replace function public.generate_invoice_number(_workspace_id uuid)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  yr text := to_char(current_date, 'YYYY');
  next_seq int;
begin
  select coalesce(max((regexp_match(invoice_number, 'INV-' || yr || '-(\d+)'))[1]::int), 0) + 1
    into next_seq
    from public.invoices
    where workspace_id = _workspace_id
      and invoice_number like 'INV-' || yr || '-%';
  return 'INV-' || yr || '-' || lpad(next_seq::text, 4, '0');
end;
$$;
revoke execute on function public.generate_invoice_number(uuid) from public, anon;
grant execute on function public.generate_invoice_number(uuid) to authenticated;

create or replace function public.set_invoice_number()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := public.generate_invoice_number(new.workspace_id);
  end if;
  return new;
end;
$$;
create trigger set_invoice_number_trg before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ============================================================
-- 8. totals recalculation
-- ============================================================
create or replace function public.recalc_invoice_totals()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  target_invoice uuid;
  new_subtotal numeric;
  cur_tax_rate numeric;
begin
  target_invoice := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0) into new_subtotal from public.invoice_items where invoice_id = target_invoice;
  select tax_rate into cur_tax_rate from public.invoices where id = target_invoice;
  update public.invoices
    set subtotal = new_subtotal,
        tax_amount = round(new_subtotal * coalesce(cur_tax_rate,0) / 100, 2),
        total = new_subtotal + round(new_subtotal * coalesce(cur_tax_rate,0) / 100, 2)
    where id = target_invoice;
  return coalesce(new, old);
end;
$$;

create trigger recalc_invoice_totals_ins after insert on public.invoice_items
  for each row execute function public.recalc_invoice_totals();
create trigger recalc_invoice_totals_upd after update on public.invoice_items
  for each row execute function public.recalc_invoice_totals();
create trigger recalc_invoice_totals_del after delete on public.invoice_items
  for each row execute function public.recalc_invoice_totals();

create or replace function public.recalc_invoice_totals_on_tax_change()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if new.tax_rate is distinct from old.tax_rate then
    new.tax_amount := round(new.subtotal * new.tax_rate / 100, 2);
    new.total := new.subtotal + new.tax_amount;
  end if;
  return new;
end;
$$;
create trigger recalc_invoice_totals_tax before update on public.invoices
  for each row execute function public.recalc_invoice_totals_on_tax_change();

-- ============================================================
-- 9. payments -> invoice status/amount_paid + timeline + notification
-- ============================================================
create or replace function public.apply_payment_to_invoice()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
  inv record;
  new_paid numeric;
begin
  if new.invoice_id is null or new.status is distinct from 'succeeded' then
    return new;
  end if;

  select * into inv from public.invoices where id = new.invoice_id for update;
  if inv.id is null then
    return new;
  end if;

  select coalesce(sum(amount), 0) into new_paid
    from public.payments
    where invoice_id = new.invoice_id and status = 'succeeded';

  update public.invoices
    set amount_paid = new_paid,
        status = case
          when new_paid >= total and total > 0 then 'paid'
          when new_paid > 0 then 'partial'
          else status
        end,
        paid_at = case when new_paid >= total and total > 0 then now() else paid_at end
    where id = new.invoice_id;

  if new_paid >= inv.total and inv.total > 0 then
    insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id, metadata)
    values (inv.client_id, inv.workspace_id, 'invoice_paid',
      'Factura ' || inv.invoice_number || ' pagada ($' || inv.total || ')', new.created_by,
      jsonb_build_object('invoice_id', inv.id, 'payment_id', new.id));
  end if;

  perform public.notify_workspace_members(
    inv.workspace_id, 'payment_received',
    'Pago recibido: ' || inv.invoice_number,
    '$' || new.amount || ' de ' || (select name from public.clients where id = inv.client_id),
    '/app/finanzas?invoice=' || inv.id::text
  );

  return new;
end;
$$;

create trigger apply_payment_to_invoice_trg after insert on public.payments
  for each row execute function public.apply_payment_to_invoice();

-- ============================================================
-- 10. overdue detection (daily cron)
-- ============================================================
create or replace function public.mark_overdue_invoices()
returns void
language sql security definer set search_path to 'public', 'pg_temp'
as $$
  update public.invoices
    set status = 'overdue'
    where status in ('sent','partial')
      and due_date is not null
      and due_date < current_date;
$$;
revoke execute on function public.mark_overdue_invoices() from public, anon, authenticated;

select cron.schedule('mark-overdue-invoices-daily', '30 6 * * *', $$select public.mark_overdue_invoices();$$);

-- ============================================================
-- 11. timeline + notifications on invoice status change
-- ============================================================
create or replace function public.tl_on_invoice_status_change()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is distinct from old.status then
    insert into public.client_timeline_events (client_id, workspace_id, event_type, title, actor_id, metadata)
    values (new.client_id, new.workspace_id, 'invoice_status_changed',
      'Factura ' || new.invoice_number || ': ' || old.status || ' → ' || new.status, auth.uid(),
      jsonb_build_object('invoice_id', new.id));

    if new.status = 'sent' then
      perform public.notify_workspace_members(
        new.workspace_id, 'invoice_sent',
        'Factura enviada: ' || new.invoice_number,
        '$' || new.total || ' a ' || (select name from public.clients where id = new.client_id),
        '/app/finanzas?invoice=' || new.id::text
      );
    elsif new.status = 'overdue' then
      perform public.notify_workspace_members(
        new.workspace_id, 'invoice_overdue',
        'Factura vencida: ' || new.invoice_number,
        '$' || (new.total - new.amount_paid) || ' pendiente de ' || (select name from public.clients where id = new.client_id),
        '/app/finanzas?invoice=' || new.id::text
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger tl_on_invoice_status_change_trg after update on public.invoices
  for each row execute function public.tl_on_invoice_status_change();
