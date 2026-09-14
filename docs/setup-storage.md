# Storage bucket setup — `client-media`

The `media_assets` table (migration 009) needs a Supabase Storage bucket called
`client-media`. Some Supabase plans reject `insert into storage.buckets` from
SQL, so create the bucket in the Dashboard.

## 1. Create the bucket

Dashboard → Storage → **New bucket**
- Name: `client-media`
- Public bucket: **Yes** (read access through public URLs)
- File size limit: `50 MB`
- Allowed MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `video/mp4`
  - `video/quicktime`
  - `application/pdf` (for consent forms uploaded under `/consents/`)

## 2. RLS policies on `storage.objects`

The first folder segment of every object path is the `workspace_id`. RLS uses
that segment to scope access to workspace members.

Run in the SQL editor:

```sql
-- SELECT (anyone authenticated can read; bucket is public anyway)
drop policy if exists client_media_select on storage.objects;
create policy client_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'client-media');

-- INSERT — only workspace members of the workspace_id in the first folder
drop policy if exists client_media_insert on storage.objects;
create policy client_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );

-- DELETE — same constraint
drop policy if exists client_media_delete on storage.objects;
create policy client_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );

-- UPDATE — same constraint (metadata edits)
drop policy if exists client_media_update on storage.objects;
create policy client_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'client-media'
    and public.is_workspace_member( (storage.foldername(name))[1]::uuid )
  );
```

## 3. Path convention

- Media: `{workspace_id}/{client_id}/{uuid}-{sanitized_filename}.{ext}`
- Consent forms: `{workspace_id}/{client_id}/consents/{uuid}-{patient_ref}.pdf`

This makes per-workspace cleanup trivial: deleting all objects under
`{workspace_id}/` removes everything that client's workspace ever uploaded.

---

# Optimización de imágenes y egress del CDN

## El problema

En agosto de 2026 la organización superó la cuota de **Cached Egress** (5 GB en
el plan Free). La causa: el bucket guardaba los PNG originales exportados desde
las herramientas de diseño — 139 archivos de 3.5 MB de promedio, algunos de
10 MB y 2160×3840 px — y la interfaz los renderizaba **en miniaturas**:

| Vista | Tamaño en pantalla | Qué descargaba |
|---|---|---|
| Tarjeta del calendario | 32×32 px | el PNG completo |
| Biblioteca de medios | grilla completa | los 179 objetos (489 MB de una sola vez) |
| Aprobaciones del portal | 48×48 px | el PNG completo |

Abrir la biblioteca una vez consumía ~10% de la cuota mensual.

> Las Image Transformations de Supabase (`?width=`) resolverían esto en una
> línea, pero requieren plan Pro o superior. Por eso la compresión ocurre en el
> navegador antes de subir.

## La solución

1. **Compresión al subir** — `src/lib/image-compress.ts` reduce el lado mayor a
   1600 px y convierte a WebP (calidad 82) antes de que el archivo llegue a
   Storage. Un PNG de 10 MB pasa a ~63 KB.
2. **Miniatura junto al original** — se guarda una versión de 400 px en
   `<carpeta>/thumbs/<nombre>.webp` y se registra en
   `media_assets.thumbnail_path` / `thumbnail_url`.
3. **Las grillas usan la miniatura** — el componente
   `src/components/shared/media-thumb.tsx` elige la miniatura y **cae al
   original** si no existe (archivos previos al backfill, videos, URLs externas
   pegadas a mano). Las vistas de una sola imagen (previsualización del editor,
   imagen principal de aprobación) siguen usando el original.

GIF, video y PDF se suben sin tocar: dibujar un GIF en un canvas lo aplanaría a
su primer frame.

## Backfill de lo ya subido

El script procesa lo que se subió antes de este cambio. Necesita la
**service_role key** (Dashboard → Project Settings → API). Esa clave no va en
`.env.local` ni en el repositorio — pásala solo en la línea de comando.

Primero un ensayo, que no escribe nada:

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
  npm run backfill:thumbnails -- --dry-run
```

Si los números cuadran, genera las miniaturas. Es **aditivo**: no modifica ni
borra nada existente.

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
  npm run backfill:thumbnails
```

### Opcional: recomprimir los originales

`--optimize-originals` reescribe cada original **en su misma ruta**, de modo que
las URLs ya guardadas en `social_posts.media_urls` siguen siendo válidas. Es
destructivo y conviene ejecutarlo después de verificar que las miniaturas se ven
bien.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run backfill:thumbnails -- --optimize-originals --dry-run
```

Nota: la ruta conserva su extensión `.png` mientras el contenido pasa a ser
WebP. Los navegadores renderizan según el `Content-Type`, así que se ve bien,
pero un archivo descargado tendrá una extensión que no coincide con su
contenido.
