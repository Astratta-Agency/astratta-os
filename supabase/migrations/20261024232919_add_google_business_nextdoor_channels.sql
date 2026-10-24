-- Permite Google Business y Nextdoor como canales de publicación.
alter table public.post_variants drop constraint if exists post_variants_channel_check;
alter table public.post_variants add constraint post_variants_channel_check
  check (channel in ('instagram','facebook','linkedin','tiktok','x','threads','google_business','nextdoor'));
