import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "client-media";

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
  const segments = [workspaceId, clientId];
  if (subfolder) segments.push(subfolder);
  segments.push(`${uid}-${safe}`);
  const storagePath = segments.join("/");

  const [imgDim, vidMeta] = await Promise.all([
    readImageDimensions(file),
    readVideoMeta(file),
  ]);

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    return { ok: false, error: "upload_failed", message: error.message };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    ok: true,
    storagePath,
    publicUrl: pub.publicUrl,
    sizeBytes: file.size,
    mimeType: file.type,
    fileName: file.name,
    ...imgDim,
    ...vidMeta,
  };
}

export async function deleteAssetFromStorage(storagePath: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}
