#!/usr/bin/env node
/**
 * Backfill thumbnails (and optionally shrink originals) in the client-media
 * bucket.
 *
 * Context: uploads used to land in Storage untouched, so the bucket filled
 * with ~3.5MB PNGs that grid views rendered into 32-48px boxes. New uploads
 * are compressed in the browser (src/lib/image-compress.ts); this script fixes
 * everything uploaded before that.
 *
 * Two independent phases:
 *
 *   thumbs (default)      Additive and safe. Writes <dir>/thumbs/<name>.webp
 *                         next to each image and records it on media_assets.
 *                         Nothing existing is modified.
 *
 *   --optimize-originals  Destructive. Re-encodes each original IN PLACE at
 *                         the same storage path, so every URL already stored
 *                         in social_posts.media_urls stays valid. The path
 *                         keeps its .png/.jpg extension while the bytes become
 *                         WebP; browsers render by Content-Type, so this is
 *                         correct, but a downloaded file's extension will not
 *                         match its contents. Run --dry-run first.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/backfill-media-thumbnails.mjs [--dry-run] [--optimize-originals]
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "client-media";
const THUMBNAIL_FOLDER = "thumbs";
const MAX_IMAGE_DIMENSION = 1600;
const THUMBNAIL_DIMENSION = 400;
const IMAGE_QUALITY = 82;
const THUMBNAIL_QUALITY = 72;
const CACHE_CONTROL = "31536000";

// GIFs are skipped: sharp would need explicit animation handling and they are
// a rounding error here. PDFs and videos are not images at all.
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const OPTIMIZE_ORIGINALS = args.has("--optimize-originals");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

function withWebpExtension(name) {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.webp`;
}

function thumbnailPathFor(storagePath) {
  const slash = storagePath.lastIndexOf("/");
  const dir = slash === -1 ? "" : storagePath.slice(0, slash + 1);
  const name = slash === -1 ? storagePath : storagePath.slice(slash + 1);
  return `${dir}${THUMBNAIL_FOLDER}/${withWebpExtension(name)}`;
}

/** Walk the bucket depth-first. Storage `list` only returns one level. */
async function listAllObjects(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) throw new Error(`list(${prefix}): ${error.message}`);
    if (!data.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Storage marks folders by returning them without metadata.
      if (entry.id === null || !entry.metadata) {
        if (entry.name !== THUMBNAIL_FOLDER) out.push(...(await listAllObjects(path)));
      } else {
        out.push({ path, name: entry.name, metadata: entry.metadata });
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

async function main() {
  console.log(
    `Mode: ${OPTIMIZE_ORIGINALS ? "thumbnails + optimize originals" : "thumbnails only"}` +
      `${DRY_RUN ? " (dry run — nothing will be written)" : ""}\n`,
  );

  const objects = await listAllObjects();
  const images = objects.filter((o) => RESIZABLE.has(o.metadata?.mimetype));
  const skipped = objects.length - images.length;

  console.log(`${objects.length} objects found (${images.length} resizable, ${skipped} skipped).`);

  let originalBytes = 0;
  let thumbBytes = 0;
  let optimizedBytes = 0;
  let thumbsWritten = 0;
  let originalsWritten = 0;
  let rowsUpdated = 0;
  const failures = [];

  for (const [i, obj] of images.entries()) {
    const label = `[${i + 1}/${images.length}] ${obj.path}`;
    try {
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(obj.path);
      if (error) throw new Error(error.message);
      const source = Buffer.from(await blob.arrayBuffer());
      originalBytes += source.length;

      const thumb = await sharp(source)
        .rotate() // honour EXIF orientation
        .resize(THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: THUMBNAIL_QUALITY })
        .toBuffer();
      thumbBytes += thumb.length;

      const thumbPath = thumbnailPathFor(obj.path);
      if (!DRY_RUN) {
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(thumbPath, thumb, {
            cacheControl: CACHE_CONTROL,
            upsert: true,
            contentType: "image/webp",
          });
        if (upErr) throw new Error(`thumb upload: ${upErr.message}`);
      }
      thumbsWritten++;

      let stored = { size: source.length };
      if (OPTIMIZE_ORIGINALS) {
        const pipeline = sharp(source)
          .rotate()
          .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: IMAGE_QUALITY });
        const { data: optimized, info } = await pipeline.toBuffer({ resolveWithObject: true });

        // Never make a file bigger than it already was.
        if (optimized.length < source.length) {
          if (!DRY_RUN) {
            const { error: ovErr } = await supabase.storage
              .from(BUCKET)
              .upload(obj.path, optimized, {
                cacheControl: CACHE_CONTROL,
                upsert: true,
                contentType: "image/webp",
              });
            if (ovErr) throw new Error(`original overwrite: ${ovErr.message}`);
          }
          stored = { size: optimized.length, width: info.width, height: info.height };
          originalsWritten++;
        }
        optimizedBytes += stored.size;
      }

      // Point the media_assets row at the thumbnail. Objects with no row
      // (consent PDFs, orphans) simply match nothing.
      if (!DRY_RUN) {
        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(obj.path).data.publicUrl;
        const thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;
        const patch = { thumbnail_path: thumbPath, thumbnail_url: thumbUrl };
        if (OPTIMIZE_ORIGINALS && stored.width) {
          patch.size_bytes = stored.size;
          patch.width = stored.width;
          patch.height = stored.height;
          patch.mime_type = "image/webp";
        }
        const { data: updated, error: dbErr } = await supabase
          .from("media_assets")
          .update(patch)
          .eq("storage_path", obj.path)
          .select("id");
        if (dbErr) throw new Error(`db update: ${dbErr.message}`);
        rowsUpdated += updated?.length ?? 0;
      }

      console.log(
        `${label}  ${fmt(source.length)} -> thumb ${(thumb.length / 1024).toFixed(0)}kB` +
          (OPTIMIZE_ORIGINALS ? `, original ${fmt(stored.size)}` : ""),
      );
    } catch (e) {
      failures.push({ path: obj.path, message: e.message });
      console.warn(`${label}  FAILED: ${e.message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Originals read:      ${fmt(originalBytes)} across ${images.length} images`);
  console.log(`Thumbnails written:  ${fmt(thumbBytes)} (${thumbsWritten})`);
  if (OPTIMIZE_ORIGINALS) {
    console.log(`Originals rewritten: ${fmt(optimizedBytes)} (${originalsWritten} replaced)`);
    console.log(`Storage saved:       ${fmt(originalBytes - optimizedBytes)}`);
  }
  console.log(`media_assets rows updated: ${rowsUpdated}`);
  console.log(
    `Grid egress per full render: ${fmt(originalBytes)} -> ${fmt(thumbBytes)} ` +
      `(${(originalBytes / Math.max(thumbBytes, 1)).toFixed(0)}x less)`,
  );
  if (failures.length) {
    console.log(`\n${failures.length} failures:`);
    for (const f of failures) console.log(`  ${f.path}: ${f.message}`);
    process.exitCode = 1;
  }
  if (DRY_RUN) console.log("\nDry run — nothing was written.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
