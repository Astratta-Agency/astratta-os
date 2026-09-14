import { describe, it, expect } from "vitest";

import { thumbnailPathFor, thumbnailUrlFor } from "@/lib/storage";

const BASE = "https://vdnblnrwkkychxzbixam.supabase.co/storage/v1/object/public/client-media/";

describe("thumbnailPathFor", () => {
  it("puts the thumbnail in a thumbs/ subfolder and forces .webp", () => {
    expect(thumbnailPathFor("ws/client/uid-photo.png")).toBe("ws/client/thumbs/uid-photo.webp");
  });

  it("keeps nested subfolders like consents/", () => {
    expect(thumbnailPathFor("ws/client/consents/uid-form.jpg")).toBe(
      "ws/client/consents/thumbs/uid-form.webp",
    );
  });

  it("handles names with dots and no extension", () => {
    expect(thumbnailPathFor("ws/client/uid-my.photo.v2.jpeg")).toBe(
      "ws/client/thumbs/uid-my.photo.v2.webp",
    );
    expect(thumbnailPathFor("ws/client/uid-noext")).toBe("ws/client/thumbs/uid-noext.webp");
  });
});

describe("thumbnailUrlFor", () => {
  it("derives the thumbnail URL from a stored public URL", () => {
    expect(thumbnailUrlFor(`${BASE}ws/client/uid-photo.png`)).toBe(
      `${BASE}ws/client/thumbs/uid-photo.webp`,
    );
  });

  it("preserves a query string", () => {
    expect(thumbnailUrlFor(`${BASE}ws/client/uid-photo.png?t=123`)).toBe(
      `${BASE}ws/client/thumbs/uid-photo.webp?t=123`,
    );
  });

  // Users can paste Drive/Dropbox links straight into the editor; those have
  // no thumbnail and must be rendered exactly as given.
  it("returns null for external URLs", () => {
    expect(thumbnailUrlFor("https://drive.google.com/file/d/abc/view")).toBeNull();
    expect(thumbnailUrlFor("")).toBeNull();
  });

  it("returns null for a URL that is already a thumbnail", () => {
    expect(thumbnailUrlFor(`${BASE}ws/client/thumbs/uid-photo.webp`)).toBeNull();
  });

  it("returns null for objects in another bucket", () => {
    const other =
      "https://vdnblnrwkkychxzbixam.supabase.co/storage/v1/object/public/workspace-logos/a/b.png";
    expect(thumbnailUrlFor(other)).toBeNull();
  });
});
