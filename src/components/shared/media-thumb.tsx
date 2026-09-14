import { useState } from "react";

import { thumbnailUrlFor } from "@/lib/storage";

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
 * blew through the CDN egress quota. This picks the ~400px thumbnail and only
 * falls back to the original when there isn't one: assets uploaded before the
 * backfill, videos, and external URLs pasted by hand.
 */
export function MediaThumb({ url, thumbnailUrl, alt = "", className }: Props) {
  const preferred = thumbnailUrl ?? thumbnailUrlFor(url);
  // Keyed by `url` so switching assets re-arms the fallback.
  const [failed, setFailed] = useState<string | null>(null);
  const src = preferred && failed !== url ? preferred : url;

  return (
    <img
      key={url}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(url)}
    />
  );
}
