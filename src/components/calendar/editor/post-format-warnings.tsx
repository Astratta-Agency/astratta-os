import type { PostStatus } from "@/lib/post-states";

interface Props {
  type: string;
}

const WARNINGS: Record<string, string> = {
  story: "Sin hashtags visibles. La caption no se publica como texto: solo como sticker overlay (limitación de Meta).",
  reel: "Formato recomendado: 9:16 vertical, 15-60 segundos.",
  carousel: "Hasta 10 imágenes ordenables abajo (drag & drop completo llega en 4.3).",
  video: "Sube el video como URL externa por ahora. Storage llega en 4.3.",
};

export function PostFormatWarnings({ type }: Props) {
  const msg = WARNINGS[type];
  if (!msg) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      {msg}
    </div>
  );
}

export type _UnusedPostStatus = PostStatus;
