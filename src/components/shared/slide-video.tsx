import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
  /**
   * Start playing with sound as soon as the video mounts. Pass false where
   * several videos can be on screen at once (e.g. the portal's list of
   * approval cards), so they don't all start talking over each other.
   */
  autoPlay?: boolean;
}

/** The SlideVideo currently playing; starting another one pauses it. */
let playing: HTMLVideoElement | null = null;

/**
 * Video for a carousel slide: starts playing with sound as soon as the slide
 * is shown, like Instagram/Facebook.
 *
 * Browsers only allow audible autoplay after the user has interacted with the
 * page. Reaching a slide takes a click, so that normally holds; if it doesn't
 * (e.g. the post opens directly on a video), playback falls back to muted and
 * the viewer can unmute from the controls.
 *
 * Only one SlideVideo plays at a time. Callers should key this by `src` so
 * leaving the slide unmounts (and stops) the video.
 */
export function SlideVideo({ src, className, autoPlay = true }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !autoPlay) return;
    video.muted = false;
    video.play().catch(() => {
      // Audible autoplay was blocked: play muted instead of showing a still.
      if (!ref.current) return;
      ref.current.muted = true;
      ref.current.play().catch(() => {});
    });
  }, [src, autoPlay]);

  useEffect(() => {
    const video = ref.current;
    return () => {
      if (playing === video) playing = null;
    };
  }, []);

  const handlePlay = () => {
    const video = ref.current;
    if (playing && playing !== video) playing.pause();
    playing = video;
  };

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      controls
      playsInline
      preload={autoPlay ? "auto" : "metadata"}
      onPlay={handlePlay}
    />
  );
}
