alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'post_approved'::text,
    'post_rejected'::text,
    'post_changes_requested'::text,
    'invite_accepted'::text,
    'payment_received'::text,
    'contract_expiring'::text,
    'new_lead'::text,
    'proposal_signed'::text
  ]));
