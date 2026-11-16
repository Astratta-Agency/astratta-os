// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./harness";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

describe("test database", () => {
  it("applies every migration from an empty database", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });
});
