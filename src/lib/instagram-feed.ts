import type { PostStatus } from "@/lib/post-states";

/** How a post shows on an Instagram profile. Stories never reach the grid. */
export type FeedKind = "post" | "carousel" | "reel";

/** Tabs of the feed view: the full grid, or one kind of content. */
export type FeedTab = "todo" | FeedKind;

export type FeedPostLike = {
  type: string;
  status: PostStatus;
  scheduled_for: string | null;
  media_urls: string[];
  format_meta?: Record<string, unknown> | null;
};

/**
 * Posts the team marked as not showing on the profile, e.g. trial reels, which
 * are published as a reel but never reach the grid. Shown by default.
 */
export function isHiddenFromFeed(post: Pick<FeedPostLike, "format_meta">): boolean {
  return post.format_meta?.hide_from_feed === true;
}

/** States that never end up on the profile, so they stay out of the preview. */
const HIDDEN_STATUSES: PostStatus[] = ["archived", "rejected"];

/**
 * Kind of a post on the profile grid, or null when it doesn't appear there
 * (stories). A plain video is published as a reel, and a feed post with
 * several media files is a carousel even if it wasn't tagged as one.
 */
export function feedKind(post: Pick<FeedPostLike, "type" | "media_urls">): FeedKind | null {
  switch (post.type) {
    case "story":
      return null;
    case "reel":
    case "video":
      return "reel";
    case "carousel":
      return "carousel";
    default:
      return post.media_urls.length > 1 ? "carousel" : "post";
  }
}

/**
 * Posts in the order Instagram shows them: newest first, so what is planned
 * for later sits on top of what is already out. Posts without a date haven't
 * been placed yet and go first, ahead of everything scheduled.
 */
export function buildFeed<T extends FeedPostLike>(posts: T[]): Array<T & { kind: FeedKind }> {
  const out: Array<T & { kind: FeedKind }> = [];
  for (const p of posts) {
    if (HIDDEN_STATUSES.includes(p.status) || isHiddenFromFeed(p)) continue;
    const kind = feedKind(p);
    if (kind) out.push({ ...p, kind });
  }
  return out.sort((a, b) => {
    if (a.scheduled_for === b.scheduled_for) return 0;
    if (!a.scheduled_for) return -1;
    if (!b.scheduled_for) return 1;
    return b.scheduled_for.localeCompare(a.scheduled_for);
  });
}

export function filterFeed<T extends { kind: FeedKind }>(feed: T[], tab: FeedTab): T[] {
  return tab === "todo" ? feed : feed.filter((p) => p.kind === tab);
}
