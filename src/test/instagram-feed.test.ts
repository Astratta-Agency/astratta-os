import { describe, expect, it } from "vitest";
import { buildFeed, feedKind, filterFeed, type FeedPostLike } from "@/lib/instagram-feed";

const post = (over: Partial<FeedPostLike> & { id?: string } = {}) => ({
  id: "p",
  type: "feed_post",
  status: "scheduled" as const,
  scheduled_for: "2026-11-10T10:00:00.000Z",
  media_urls: ["a.jpg"],
  ...over,
});

describe("feedKind", () => {
  it("maps post types to how they show on the profile", () => {
    expect(feedKind(post({ type: "feed_post" }))).toBe("post");
    expect(feedKind(post({ type: "other" }))).toBe("post");
    expect(feedKind(post({ type: "carousel" }))).toBe("carousel");
    expect(feedKind(post({ type: "reel" }))).toBe("reel");
    expect(feedKind(post({ type: "video" }))).toBe("reel");
  });

  it("leaves stories off the grid", () => {
    expect(feedKind(post({ type: "story" }))).toBeNull();
  });

  it("treats a feed post with several files as a carousel", () => {
    expect(feedKind(post({ type: "feed_post", media_urls: ["a.jpg", "b.jpg"] }))).toBe("carousel");
  });
});

describe("buildFeed", () => {
  it("orders newest first with undated posts on top", () => {
    const feed = buildFeed([
      post({ id: "old", scheduled_for: "2026-10-01T10:00:00.000Z" }),
      post({ id: "nodate", scheduled_for: null }),
      post({ id: "new", scheduled_for: "2026-12-01T10:00:00.000Z" }),
    ]);
    expect(feed.map((p) => p.id)).toEqual(["nodate", "new", "old"]);
  });

  it("drops stories, archived and rejected posts", () => {
    const feed = buildFeed([
      post({ id: "ok" }),
      post({ id: "story", type: "story" }),
      post({ id: "arch", status: "archived" }),
      post({ id: "rej", status: "rejected" }),
    ]);
    expect(feed.map((p) => p.id)).toEqual(["ok"]);
  });

  it("leaves out posts marked as hidden from the feed (trial reels)", () => {
    const feed = buildFeed([
      post({ id: "shown", type: "reel" }),
      post({ id: "trial", type: "reel", format_meta: { hide_from_feed: true } }),
      post({ id: "explicit", type: "reel", format_meta: { hide_from_feed: false } }),
    ]);
    expect(feed.map((p) => p.id).sort()).toEqual(["explicit", "shown"]);
  });

  it("filters by tab", () => {
    const feed = buildFeed([
      post({ id: "r", type: "reel" }),
      post({ id: "c", type: "carousel" }),
      post({ id: "p" }),
    ]);
    expect(filterFeed(feed, "todo")).toHaveLength(3);
    expect(filterFeed(feed, "reel").map((p) => p.id)).toEqual(["r"]);
    expect(filterFeed(feed, "carousel").map((p) => p.id)).toEqual(["c"]);
    expect(filterFeed(feed, "post").map((p) => p.id)).toEqual(["p"]);
  });
});
