alter policy approval_history_client_admin_insert on public.content_approval_history
  with check (
    is_client_admin(client_id)
    and (action = any (array['approved'::text,'rejected'::text,'changes_requested'::text]))
    and (actor_user_id = (select auth.uid()))
  );
