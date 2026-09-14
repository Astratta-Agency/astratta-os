alter table public.content_approval_history drop constraint content_approval_history_action_check;
alter table public.content_approval_history add constraint content_approval_history_action_check
  check (action = any (array['sent_for_approval'::text,'approved'::text,'rejected'::text,'changes_requested'::text,'resent'::text,'auto_expired'::text]));
