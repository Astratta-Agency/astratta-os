/**
 * Client-side image downscaling + WebP conversion.
 *
 * Design-tool exports were being uploaded untouched, so the bucket filled up
 * with multi-megabyte PNGs that the calendar and the media library then
 * rendered into 32px and 48px thumbnails. Every image is now shrunk before it
 * reaches Storage, and a small thumbnail is stored next to it for grid views.
 *
 * WebP is preferred, but Safari cannot encode WebP from a canvas, so those
 * browsers fall back to JPEG. Without that fallback every Safari upload went
 * to Storage as the raw multi-megabyte PNG.
 *
 * Every helper here degrades to `null` instead of throwing: if the file turns
 * out not to be decodable, the caller uploads the original untouched.
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
  /** "image/webp", or "image/jpeg" where the browser can't encode WebP. */
  mimeType: string;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decode `source`, scale its longest edge down to `maxDimension` and re-encode
 * as WebP (or JPEG when WebP encoding is unsupported). Images already smaller
 * than `maxDimension` are re-encoded but never upscaled. Returns `null` if any
 * step fails.
 */
export async function resizeImage(
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

    // Safari returns a PNG when asked for an unsupported type rather than
    // failing, so confirm we actually got WebP back.
    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.type === "image/webp") {
      return { blob: webp, width, height, mimeType: "image/webp" };
    }

    // JPEG has no alpha channel and would render transparent areas black, so
    // flatten onto white first.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (jpeg && jpeg.type === "image/jpeg") {
      return { blob: jpeg, width, height, mimeType: "image/jpeg" };
    }
    return null;
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
  const resized = await resizeImage(file, MAX_IMAGE_DIMENSION, IMAGE_QUALITY);
  if (!resized) return null;
  return resized.blob.size < file.size ? resized : null;
}

/** Build the small grid thumbnail. Always worth it, even for small sources. */
export async function buildThumbnail(source: Blob): Promise<ResizedImage | null> {
  return resizeImage(source, THUMBNAIL_DIMENSION, THUMBNAIL_QUALITY);
}
