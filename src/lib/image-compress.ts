/**
 * Client-side image downscaling + WebP conversion.
 *
 * Design-tool exports were being uploaded untouched, so the bucket filled up
 * with multi-megabyte PNGs that the calendar and the media library then
 * rendered into 32px and 48px thumbnails. Every image is now shrunk before it
 * reaches Storage, and a small thumbnail is stored next to it for grid views.
 *
 * Every helper here degrades to `null` instead of throwing: if a browser can't
 * encode WebP, or the file turns out not to be decodable, the caller uploads
 * the original untouched.
 */

/** Longest edge kept for the stored original. Covers full-bleed previews. */
export const MAX_IMAGE_DIMENSION = 1600;
export const IMAGE_QUALITY = 0.82;

/** Longest edge for grid thumbnails (calendar cards, library tiles). */
export const THUMBNAIL_DIMENSION = 400;
export const THUMBNAIL_QUALITY = 0.72;

/**
 * GIFs are excluded on purpose — drawing one to a canvas flattens it to its
 * first frame. Videos and PDFs are passed through by the caller.
 */
const COMPRESSIBLE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isCompressibleImage(mimeType: string): boolean {
  return COMPRESSIBLE_MIME.has(mimeType);
}

export type ResizedImage = {
  blob: Blob;
  width: number;
  height: number;
};

/**
 * Decode `source`, scale its longest edge down to `maxDimension` and re-encode
 * as WebP. Images already smaller than `maxDimension` are re-encoded but never
 * upscaled. Returns `null` if any step fails.
 */
export async function resizeToWebp(
  source: Blob,
  maxDimension: number,
  quality: number,
): Promise<ResizedImage | null> {
  let bitmap: ImageBitmap;
  try {
    // `from-image` applies EXIF orientation, so phone photos keep their
    // rotation instead of coming out sideways.
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
    // Safari has historically returned a PNG when asked for an unsupported
    // type rather than failing, so confirm we actually got WebP back.
    if (!blob || blob.type !== "image/webp") return null;

    return { blob, width, height };
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * Shrink an upload for storage. Returns `null` when compression isn't possible
 * or when the result would be bigger than the original (already-optimised
 * JPEGs often re-encode larger).
 */
export async function compressForUpload(file: File): Promise<ResizedImage | null> {
  if (!isCompressibleImage(file.type)) return null;
  const resized = await resizeToWebp(file, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
  if (!resized) return null;
  return resized.blob.size < file.size ? resized : null;
}

/** Build the small grid thumbnail. Always worth it, even for small sources. */
export async function buildThumbnail(source: Blob): Promise<ResizedImage | null> {
  return resizeToWebp(source, THUMBNAIL_DIMENSION, THUMBNAIL_QUALITY);
}
