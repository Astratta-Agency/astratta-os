alter policy social_posts_client_admin_update_approval on public.social_posts
  with check (
    (status = any (array['approved'::post_status,'rejected'::post_status,'changes_requested'::post_status,'pending_approval'::post_status]))
    and is_client_admin(client_id)
  );
