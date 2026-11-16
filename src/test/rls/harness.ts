import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Historical baseline. `supabase/migrations/` starts on 2026-06-30 and assumes
 * the core tables already exist: those come from docs/migrations/001-013, which
 * were applied by hand before the Supabase ledger began. 014-016 are written-up
 * copies of work the ledger itself already contains, so they are NOT part of
 * the baseline (running them would collide with the ledger's `create table`).
 */
const BASELINE = /^0(0\d|1[0-3])_.*\.sql$/;

export function migrationFiles(): { label: string; file: string }[] {
  const baseline = readdirSync(path.join(ROOT, "docs/migrations"))
    .filter((f) => BASELINE.test(f))
    .sort()
    .map((f) => ({ label: `docs/migrations/${f}`, file: path.join(ROOT, "docs/migrations", f) }));
  const ledger = readdirSync(path.join(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ label: `supabase/migrations/${f}`, file: path.join(ROOT, "supabase/migrations", f) }));
  return [...baseline, ...ledger];
}

/** PGlite has no pg_cron / pg_net; the shim provides no-op `cron` and `net` schemas instead. */
function prepare(sql: string): string {
  return sql.replace(
    /create\s+extension\s+if\s+not\s+exists\s+"?(pg_cron|pg_net)"?\s*;?/gi,
    "-- (pg_cron / pg_net stubbed by shim.sql)",
  );
}

/**
 * Splits a SQL file into top-level statements, respecting '...' strings,
 * "..." identifiers, -- and block comments, and $tag$ ... $tag$ bodies.
 *
 * Needed because some migrations (e.g. docs/migrations/010) rely on each
 * statement committing on its own: Postgres refuses to use a freshly added enum
 * value inside the same transaction that added it, and `exec()` on a whole file
 * runs it as one implicit transaction.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      const j = sql.indexOf("\n", i);
      const end = j === -1 ? n : j;
      cur += sql.slice(i, end);
      i = end;
    } else if (two === "/*") {
      const j = sql.indexOf("*/", i + 2);
      const end = j === -1 ? n : j + 2;
      cur += sql.slice(i, end);
      i = end;
    } else if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === '"') {
      const j = sql.indexOf('"', i + 1);
      const end = j === -1 ? n : j + 1;
      cur += sql.slice(i, end);
      i = end;
    } else if (c === "$" && /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i, i + 64))) {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64))![0];
      const j = sql.indexOf(tag, i + tag.length);
      const end = j === -1 ? n : j + tag.length;
      cur += sql.slice(i, end);
      i = end;
    } else if (c === ";") {
      out.push(cur);
      cur = "";
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  out.push(cur);
  const onlyComments = (stmt: string) => stmt.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim() === "";
  return out.map((x) => x.trim()).filter((x) => x && !onlyComments(x));
}

/**
 * Two ledger migrations seed templates/clauses for this exact workspace id
 * (Astratta's own workspace, which existed in production before the ledger
 * did). Recreate it as a precondition so those migrations can run.
 */
export const LEGACY_WORKSPACE_ID = "1e14b4d7-9584-48be-adef-72e97b39d335";
const FIRST_LEDGER_FILE = "supabase/migrations/";

async function createLegacyWorkspace(db: PGlite) {
  await db.exec(`
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f0', 'founder@legacy.test');
    insert into public.workspaces (id, name, slug, created_by)
    values ('${LEGACY_WORKSPACE_ID}', 'Legacy workspace', 'legacy', '00000000-0000-4000-8000-0000000000f0');
  `);
}

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(path.join(ROOT, "src/test/rls/shim.sql"), "utf8"));
  let legacyCreated = false;
  for (const { label, file } of migrationFiles()) {
    if (!legacyCreated && label.startsWith(FIRST_LEDGER_FILE)) {
      await createLegacyWorkspace(db);
      legacyCreated = true;
    }
    for (const stmt of splitStatements(prepare(readFileSync(file, "utf8")))) {
      try {
        await db.exec(stmt);
      } catch (e) {
        throw new Error(
          `Migration failed: ${label}\n${(e as Error).message}\n--- statement ---\n${stmt.slice(0, 300)}`,
        );
      }
    }
  }
  return db;
}

// ---------------------------------------------------------------------------
// Acting as a Supabase caller
// ---------------------------------------------------------------------------

export type Actor =
  | { kind: "anon" }
  | { kind: "user"; id: string }
  | { kind: "service" };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

type Sql = { query: PGlite["query"]; exec: PGlite["exec"] };

/**
 * Runs `fn` inside a transaction with the same role and JWT claims PostgREST
 * would set for this caller, then ALWAYS rolls back so tests never leak state
 * into each other.
 */
export async function as<T>(db: PGlite, actor: Actor, fn: (sql: Sql) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    if (actor.kind === "anon") {
      await db.exec("set local role anon");
      await db.query("select set_config('request.jwt.claim.role', 'anon', true)");
    } else if (actor.kind === "service") {
      await db.exec("set local role service_role");
      await db.query("select set_config('request.jwt.claim.role', 'service_role', true)");
    } else {
      await db.exec("set local role authenticated");
      await db.query(
        "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)",
        [actor.id],
      );
    }
    return await fn(db);
  } finally {
    await db.exec("rollback");
  }
}

/** Rows the caller can see for a query (RLS applied). */
export async function rows<R = Record<string, unknown>>(
  db: PGlite,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return as(db, actor, async (s) => (await s.query<R>(sql, params)).rows);
}

/** Rows affected by a write (RLS applied). 0 means "silently filtered". */
export async function affected(db: PGlite, actor: Actor, sql: string, params: unknown[] = []): Promise<number> {
  return as(db, actor, async (s) => (await s.query(sql, params)).affectedRows ?? 0);
}

/** Resolves to the error message if the statement is rejected, or null if it succeeded. */
export async function denied(db: PGlite, actor: Actor, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await as(db, actor, (s) => s.query(sql, params));
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
