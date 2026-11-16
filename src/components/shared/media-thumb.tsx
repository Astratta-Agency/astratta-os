import { useState } from "react";
import { ImageOff } from "lucide-react";

import { isVideoUrl, thumbnailUrlFor } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface Props {
  /** Public URL of the full-size asset. */
  url: string;
  /** Thumbnail URL when the caller already has it (e.g. a media_assets row). */
  thumbnailUrl?: string | null;
  alt?: string;
  className?: string;
}

/**
 * Renders the small variant of a stored image instead of the original.
 *
 * Grid views (calendar cards, the media library, approval strips) used to load
 * multi-megabyte originals into boxes a few dozen pixels wide, which is what
 * blew through the CDN egress quota. This picks the ~400px thumbnail; external
 * URLs pasted by hand have none and are rendered as-is.
 *
 * When one of our thumbnails is missing, a placeholder is shown rather than
 * falling back to the original: a single calendar view of un-thumbnailed
 * uploads once pulled ~90MB of full-size PNGs. Missing thumbnails are fixed by
 * scripts/backfill-media-thumbnails.mjs.
 */
export function MediaThumb({ url, thumbnailUrl, alt = "", className }: Props) {
  const isVideo = isVideoUrl(url);
  const preferred = isVideo ? null : thumbnailUrl ?? thumbnailUrlFor(url);
  // Keyed by `url` so switching assets re-arms the placeholder.
  const [failed, setFailed] = useState<string | null>(null);

  if (isVideo) {
    // Videos have no thumbnail. preload="metadata" fetches only enough bytes
    // to paint the first frame (#t=0.1 makes Safari show it), not the file.
    return (
      <video
        key={url}
        src={`${url}#t=0.1`}
        aria-label={alt || undefined}
        className={className}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  if (preferred && failed === url) {
    return (
      <div
        role="img"
        aria-label={alt || "Vista previa no disponible"}
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
      >
        <ImageOff className="h-1/3 max-h-6 w-1/3 max-w-6" />
      </div>
    );
  }

  return (
    <img
      key={url}
      src={preferred ?? url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={preferred ? () => setFailed(url) : undefined}
    />
  );
}
