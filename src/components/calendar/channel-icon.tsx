import { Instagram, Facebook, Linkedin } from "lucide-react";
import type { Channel } from "@/lib/post-states";
import { cn } from "@/lib/utils";

interface Props {
  channel: Channel;
  size?: "sm" | "md";
  className?: string;
}

export function ChannelIcon({ channel, size = "sm", className }: Props) {
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const cls = cn(dim, className);
  switch (channel) {
    case "instagram":
      return <Instagram className={cls} aria-label="Instagram" />;
    case "facebook":
      return <Facebook className={cls} aria-label="Facebook" />;
    case "linkedin":
      return <Linkedin className={cls} aria-label="LinkedIn" />;
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-label="TikTok">
          <path d="M19.6 6.3a5.5 5.5 0 01-3.4-1.2v8.6a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v2.6a3 3 0 102 2.8V2h2.5a5.5 5.5 0 003.5 3.2v2z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-label="X">
          <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.5L4.5 21H1.6l7.5-8.6L1 3h6.6l4.5 6L17.5 3z" />
        </svg>
      );
    case "threads":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-label="Threads">
          <path d="M12 2.5C6.8 2.5 3 6.3 3 11.9c0 5.4 3.5 9.5 9 9.5 3 0 5.4-1.1 6.7-3l-1.8-1.2c-.9 1.3-2.6 2.1-4.8 2.1-4 0-6.5-2.9-6.7-7 .9-1.7 2.7-3 5-3 2.1 0 3.6.9 4.3 2.4-1-.4-2.1-.6-3.3-.6-2.5 0-4.3 1.3-4.3 3.2 0 1.9 1.7 3.2 4 3.2 2.7 0 4.6-1.6 4.9-4.3.6.4 1.2 1 1.6 1.8.5-1 .8-2.1.8-3.4C18.4 6 15.6 2.5 12 2.5zm.7 11.9c-.2 1.3-1.1 2-2.6 2-1.2 0-2-.5-2-1.4 0-.8.8-1.4 2.1-1.4 1 0 1.9.2 2.5.5v.3z" />
        </svg>
      );
  }
}
