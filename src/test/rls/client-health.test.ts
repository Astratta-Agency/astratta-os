// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, LEGACY_WORKSPACE_ID as WS } from "./harness";

const CLIENT = "00000000-0000-4000-8000-00000000c001";
const MEMBER = "00000000-0000-4000-8000-00000000a001";
const PORTAL = "00000000-0000-4000-8000-00000000a002";
const OUTSIDER = "00000000-0000-4000-8000-00000000a003";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${MEMBER}', 'member@test'), ('${PORTAL}', 'portal@test'), ('${OUTSIDER}', 'outsider@test');
    insert into public.workspace_members (workspace_id, user_id) values ('${WS}', '${MEMBER}');
  `);
}, 120_000);

/** Runs `fn` as the database owner with one active client, then rolls back. */
async function scenario<T>(fn: () => Promise<T>, status = "active"): Promise<T> {
  await db.exec("begin");
  try {
    await db.exec(
      `insert into public.clients (id, workspace_id, name, slug, status)
       values ('${CLIENT}', '${WS}', 'Acme', 'acme', '${status}')`,
    );
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

type Health = { health_score: number | null; score: number | null; breakdown: any };
async function health(): Promise<Health> {
  const { rows } = await db.query<Health>(
    `select c.health_score, h.score, h.breakdown
       from public.clients c left join public.client_health h on h.client_id = c.id
      where c.id = '${CLIENT}'`,
  );
  return rows[0];
}

const invoice = (n: string, status: string, due: string) =>
  db.exec(
    `insert into public.invoices (workspace_id, client_id, invoice_number, status, due_date, total)
     values ('${WS}', '${CLIENT}', '${n}', '${status}', ${due}, 1000)`,
  );
const task = (title: string, status: string, due: string) =>
  db.exec(
    `insert into public.tasks (workspace_id, client_id, title, status, due_date)
     values ('${WS}', '${CLIENT}', '${title}', '${status}', ${due})`,
  );
const post = (title: string, status: string) =>
  db.exec(
    `insert into public.social_posts (workspace_id, client_id, title, status)
     values ('${WS}', '${CLIENT}', '${title}', '${status}')`,
  );

describe("client health score", () => {
  it("is empty for a new client with no invoices, tasks or posts", async () => {
    await scenario(async () => {
      const h = await health();
      expect(h.health_score).toBeNull();
      expect(h.breakdown.reason).toBe("no_data");
    });
  });

  it("is 100 when everything is on time", async () => {
    await scenario(async () => {
      await invoice("A-1", "paid", "current_date - 10");
      await invoice("A-2", "sent", "current_date + 10");
      await task("on time", "todo", "current_date + 3");
      await post("ok", "approved");
      const h = await health();
      expect(h.health_score).toBe(100);
      expect(h.score).toBe(100);
      expect(h.breakdown.components.payments.open_count).toBe(1);
    });
  });

  it("drops with past-due invoices, by how late they are", async () => {
    await scenario(async () => {
      await invoice("A-1", "overdue", "current_date - 3"); // -15
      await invoice("A-2", "sent", "current_date - 45"); // -50, not yet marked overdue by the cron
      const h = await health();
      const p = h.breakdown.components.payments;
      expect(p.score).toBe(35);
      expect(p.overdue_count).toBe(2);
      expect(Number(p.overdue_amount)).toBe(2000);
      expect(p.max_days_overdue).toBe(45);
      // payments 35 (w35) + relationship 100 from the "client created" event (w15)
      expect(h.health_score).toBe(Math.round((35 * 35 + 15 * 100) / 50));
    });
  });

  it("recovers when the invoice is paid", async () => {
    await scenario(async () => {
      await invoice("A-1", "overdue", "current_date - 45");
      expect((await health()).breakdown.components.payments.score).toBe(50);
      await db.exec(`update public.invoices set status = 'paid' where client_id = '${CLIENT}'`);
      expect((await health()).health_score).toBe(100);
    });
  });

  it("measures delivery as the share of current tasks that are past due", async () => {
    await scenario(async () => {
      await task("late", "todo", "current_date - 2");
      await task("fine", "doing", "current_date + 2");
      await task("no date", "todo", "null");
      await task("done", "done", "current_date - 5");
      const d = (await health()).breakdown.components.delivery;
      expect(d).toMatchObject({ score: 75, open_tasks: 3, overdue_tasks: 1 });

      await db.exec(`update public.tasks set status = 'done' where title = 'late'`);
      expect((await health()).breakdown.components.delivery.score).toBe(100);
    });
  });

  it("counts a parent task through its subtasks only", async () => {
    await scenario(async () => {
      await task("parent", "todo", "current_date - 2");
      await db.exec(
        `insert into public.tasks (workspace_id, client_id, title, status, due_date, parent_task_id)
         select workspace_id, client_id, 'child', 'todo', current_date + 5, id from public.tasks where title = 'parent'`,
      );
      expect((await health()).breakdown.components.delivery).toMatchObject({ score: 100, open_tasks: 1 });
    });
  });

  it("penalises content with changes requested or stuck waiting for approval", async () => {
    await scenario(async () => {
      await post("a", "published");
      await post("b", "approved");
      await post("c", "changes_requested");
      await post("d", "pending_approval"); // just sent: not stalled yet
      await db.exec(
        `insert into public.social_posts (workspace_id, client_id, title, status, last_approval_sent_at)
         values ('${WS}', '${CLIENT}', 'e', 'pending_approval', now() - interval '9 days')`,
      );
      const a = (await health()).breakdown.components.approvals;
      expect(a).toMatchObject({ score: 60, recent_posts: 5, changes_requested: 1, stalled: 1 });
    });
  });

  it("reflects the contract in the relationship component", async () => {
    await scenario(async () => {
      await task("t", "todo", "null");
      await db.exec(
        `insert into public.contracts (workspace_id, client_id, title, service_type, status, end_date)
         values ('${WS}', '${CLIENT}', 'c', 'social', 'active', current_date + 10)`,
      );
      let r = (await health()).breakdown.components.relationship;
      expect(r).toMatchObject({ contract: "expiring", score: 75 });

      await db.exec(`update public.contracts set auto_renew = true where client_id = '${CLIENT}'`);
      r = (await health()).breakdown.components.relationship;
      expect(r).toMatchObject({ contract: "active", score: 100 });
    });
  });

  it("is cleared for prospect / churned clients and comes back when reactivated", async () => {
    await scenario(async () => {
      await invoice("A-1", "paid", "current_date - 10");
      expect((await health()).health_score).toBe(100);
      await db.exec(`update public.clients set status = 'churned' where id = '${CLIENT}'`);
      const h = await health();
      expect(h.health_score).toBeNull();
      expect(h.breakdown.reason).toBe("status");
      await db.exec(`update public.clients set status = 'active' where id = '${CLIENT}'`);
      expect((await health()).health_score).toBe(100);
    });
  });

  it("cannot be set by hand", async () => {
    await scenario(async () => {
      await invoice("A-1", "overdue", "current_date - 45");
      const before = (await health()).health_score;
      await db.exec(`update public.clients set health_score = 99, name = 'Acme 2' where id = '${CLIENT}'`);
      expect((await health()).health_score).toBe(before);
    });
  });

  it("the daily job picks up due dates that passed without any write", async () => {
    await scenario(async () => {
      await invoice("A-1", "sent", "current_date + 1");
      expect((await health()).health_score).toBe(100);
      // Simulate time passing: bypass the triggers, as if the date had moved on.
      await db.exec(`alter table public.invoices disable trigger trg_invoices_refresh_client_health`);
      await db.exec(`update public.invoices set due_date = current_date - 40`);
      await db.exec(`alter table public.invoices enable trigger trg_invoices_refresh_client_health`);
      expect((await health()).health_score).toBe(100);
      await db.exec(`select public.refresh_all_client_health()`);
      expect((await health()).breakdown.components.payments.score).toBe(50);
    });
  });

  it("deleting a client with scored rows works", async () => {
    await scenario(async () => {
      await task("t", "todo", "current_date - 2");
      await post("p", "approved");
      await db.exec(`delete from public.clients where id = '${CLIENT}'`);
      const { rows } = await db.query(`select 1 from public.client_health where client_id = '${CLIENT}'`);
      expect(rows).toHaveLength(0);
    });
  });

  it("schedules the daily recalculation", async () => {
    const { rows } = await db.query<{ schedule: string }>(
      `select schedule from cron.job where jobname = 'refresh-client-health-daily'`,
    );
    expect(rows).toEqual([{ schedule: "0 9 * * *" }]);
  });
});

describe("client_health access", () => {
  const seen = (uid: string) =>
    scenario(async () => {
      await db.exec(`insert into public.client_users (client_id, user_id) values ('${CLIENT}', '${PORTAL}')`);
      await invoice("A-1", "overdue", "current_date - 45");
      await db.exec("savepoint s");
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      const { rows } = await db.query(`select score from public.client_health where client_id = '${CLIENT}'`);
      return rows.length;
    });

  it("workspace members can read the breakdown", async () => {
    expect(await seen(MEMBER)).toBe(1);
  });

  it("portal users and outsiders cannot", async () => {
    expect(await seen(PORTAL)).toBe(0);
    expect(await seen(OUTSIDER)).toBe(0);
  });

  it("nobody can write it or call the functions through the API", async () => {
    const attempt = (role: string, sql: string) =>
      scenario(async () => {
        await db.exec(`set local role ${role}`);
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER]);
        try {
          await db.exec(sql);
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      });
    expect(await attempt("authenticated", `update public.client_health set score = 1`)).toMatch(/permission denied/);
    expect(await attempt("authenticated", `select public.refresh_all_client_health()`)).toMatch(/permission denied/);
    expect(await attempt("authenticated", `select public.compute_client_health('${CLIENT}')`)).toMatch(
      /permission denied/,
    );
    expect(await attempt("anon", `select * from public.client_health`)).toMatch(/permission denied/);
  });
});
