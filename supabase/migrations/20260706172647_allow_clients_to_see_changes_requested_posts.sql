alter policy social_posts_client_users_select on public.social_posts
  using (
    (status = any (array['pending_approval'::post_status,'approved'::post_status,'rejected'::post_status,'changes_requested'::post_status,'scheduled'::post_status,'published'::post_status]))
    and (exists (
      select 1 from client_users cu
      where cu.client_id = social_posts.client_id
        and cu.user_id = (select auth.uid())
        and cu.status = 'active'::text
    ))
  );
