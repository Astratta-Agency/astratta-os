-- Miniaturas para media_assets.
--
-- El bucket "client-media" guardaba los PNG originales (3.5MB de promedio) y
-- el calendario, la biblioteca y el portal los renderizaban dentro de cajas de
-- 32-48px. Eso disparó el egress cacheado del CDN por encima de la cuota.
--
-- A partir de ahora cada imagen se comprime en el cliente antes de subirse y
-- se guarda una miniatura en <carpeta>/thumbs/<nombre>.webp. Estas columnas
-- registran esa miniatura; quedan nulas para videos y PDFs.

alter table public.media_assets
  add column if not exists thumbnail_path text,
  add column if not exists thumbnail_url text;

comment on column public.media_assets.thumbnail_path is
  'Ruta en Storage de la miniatura WebP (~400px). Null si no se pudo generar.';
comment on column public.media_assets.thumbnail_url is
  'URL pública de la miniatura. Las vistas de grilla usan esta, no public_url.';
