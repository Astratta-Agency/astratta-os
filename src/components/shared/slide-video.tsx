import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
}

/**
 * Video for a carousel slide: starts playing with sound as soon as the slide
 * is shown, like Instagram/Facebook.
 *
 * Browsers only allow audible autoplay after the user has interacted with the
 * page. Reaching a slide takes a click, so that normally holds; if it doesn't
 * (e.g. the post opens directly on a video), playback falls back to muted and
 * the viewer can unmute from the controls.
 *
 * Callers should key this by `src` so leaving the slide unmounts (and stops)
 * the video.
 */
export function SlideVideo({ src, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = false;
    video.play().catch(() => {
      // Audible autoplay was blocked: play muted instead of showing a still.
      if (!ref.current) return;
      ref.current.muted = true;
      ref.current.play().catch(() => {});
    });
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      controls
      playsInline
      preload="auto"
    />
  );
}
