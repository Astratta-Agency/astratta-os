import { supabase } from "@/integrations/supabase/client";
import { buildThumbnail, compressForUpload } from "@/lib/image-compress";

export const BUCKET = "client-media";

/** Prefix every public URL served out of {@link BUCKET} carries. */
const PUBLIC_URL_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Subfolder holding the grid thumbnail that mirrors each uploaded image. */
const THUMBNAIL_FOLDER = "thumbs";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "application/pdf", // for consent forms only
]);

export type UploadOk = {
  ok: true;
  storagePath: string;
  publicUrl: string;
  /** Null for videos, PDFs and anything the browser could not re-encode. */
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type UploadErr = {
  ok: false;
  error: "file_too_large" | "invalid_type" | "upload_failed";
  message?: string;
};

export type UploadResult = UploadOk | UploadErr;

export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  return ext ? `${base}${ext}` : base;
}

/** Swap any extension for `.webp`. Used once an image has been re-encoded. */
function withWebpExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.webp`;
}

/**
 * Storage path of the thumbnail mirroring `storagePath`, i.e.
 * `ws/client/uid-photo.webp` -> `ws/client/thumbs/uid-photo.webp`.
 */
export function thumbnailPathFor(storagePath: string): string {
  const slash = storagePath.lastIndexOf("/");
  const dir = slash === -1 ? "" : storagePath.slice(0, slash + 1);
  const name = slash === -1 ? storagePath : storagePath.slice(slash + 1);
  return `${dir}${THUMBNAIL_FOLDER}/${withWebpExtension(name)}`;
}

/**
 * Derive a thumbnail URL from a stored public URL, so callers holding only a
 * `social_posts.media_urls` string can render the small variant without a
 * lookup against `media_assets`.
 *
 * Returns null for anything that isn't one of our public objects — users can
 * paste external Drive/Dropbox links, and those must be rendered untouched.
 */
export function thumbnailUrlFor(publicUrl: string): string | null {
  const at = publicUrl.indexOf(PUBLIC_URL_PREFIX);
  if (at === -1) return null;

  const base = publicUrl.slice(0, at + PUBLIC_URL_PREFIX.length);
  const rest = publicUrl.slice(at + PUBLIC_URL_PREFIX.length);
  const q = rest.indexOf("?");
  const path = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? "" : rest.slice(q);

  if (!path || path.includes(`/${THUMBNAIL_FOLDER}/`)) return null;
  return `${base}${thumbnailPathFor(path)}${query}`;
}

async function readImageDimensions(
  file: File,
): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

async function readVideoMeta(
  file: File,
): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  if (!file.type.startsWith("video/")) return {};
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const out = {
        width: v.videoWidth || undefined,
        height: v.videoHeight || undefined,
        durationSeconds: isFinite(v.duration) ? Number(v.duration.toFixed(2)) : undefined,
      };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    v.src = url;
  });
}

export type UploadOptions = {
  file: File;
  workspaceId: string;
  clientId: string;
  /** Optional subfolder under the client folder, e.g. "consents". */
  subfolder?: string;
};

export async function uploadAsset(opts: UploadOptions): Promise<UploadResult> {
  const { file, workspaceId, clientId, subfolder } = opts;

  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "invalid_type" };
  }

  const safe = sanitizeFilename(file.name);
  const uid = (crypto as any).randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const [imgDim, vidMeta] = await Promise.all([
    readImageDimensions(file),
    readVideoMeta(file),
  ]);

  // Downscale before upload. A null result means "upload the file as-is" —
  // videos, PDFs, animated GIFs, and images that don't get smaller.
  const compressed = await compressForUpload(file);
  const body: Blob = compressed?.blob ?? file;
  const mimeType = compressed ? "image/webp" : file.type;

  const segments = [workspaceId, clientId];
  if (subfolder) segments.push(subfolder);
  const objectName = `${uid}-${compressed ? withWebpExtension(safe) : safe}`;
  segments.push(objectName);
  const storagePath = segments.join("/");

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
    cacheControl: "31536000",
    upsert: false,
    contentType: mimeType,
  });
  if (error) {
    return { ok: false, error: "upload_failed", message: error.message };
  }

  // Grid views render the thumbnail instead of the full image. Best-effort:
  // a missing thumbnail only costs egress, so it must never fail the upload.
  let thumbnailPath: string | null = null;
  const thumbnail = await buildThumbnail(body);
  if (thumbnail) {
    const candidate = thumbnailPathFor(storagePath);
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(candidate, thumbnail.blob, {
        cacheControl: "31536000",
        upsert: true,
        contentType: "image/webp",
      });
    if (thumbError) {
      console.warn("Thumbnail upload failed for", storagePath, thumbError);
    } else {
      thumbnailPath = candidate;
    }
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const thumbnailUrl = thumbnailPath
    ? supabase.storage.from(BUCKET).getPublicUrl(thumbnailPath).data.publicUrl
    : null;

  return {
    ok: true,
    storagePath,
    publicUrl: pub.publicUrl,
    thumbnailPath,
    thumbnailUrl,
    sizeBytes: body.size,
    mimeType,
    fileName: file.name,
    ...imgDim,
    ...vidMeta,
    // Dimensions reflect what was actually stored, not the source file.
    ...(compressed ? { width: compressed.width, height: compressed.height } : {}),
  };
}

export async function deleteAssetFromStorage(storagePath: string) {
  // Remove the thumbnail alongside the original so it can't outlive it.
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath, thumbnailPathFor(storagePath)]);
  if (error) throw error;
}
