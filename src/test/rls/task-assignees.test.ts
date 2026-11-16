// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { affected, as, createTestDb, denied, rows, user, LEGACY_WORKSPACE_ID as WS } from "./harness";

const OWNER = "00000000-0000-4000-8000-00000000b001";
const A = "00000000-0000-4000-8000-00000000b002"; // team member
const B = "00000000-0000-4000-8000-00000000b003"; // team member
const VIEWER = "00000000-0000-4000-8000-00000000b004"; // non-writer member
const OUTSIDER = "00000000-0000-4000-8000-00000000b005";
const TASK = "00000000-0000-4000-8000-00000000d001";

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'o@t'), ('${A}', 'a@t'), ('${B}', 'b@t'), ('${VIEWER}', 'v@t'), ('${OUTSIDER}', 'x@t');
    insert into public.workspace_members (workspace_id, user_id, role, status) values
      ('${WS}', '${OWNER}', 'owner', 'active'),
      ('${WS}', '${A}', 'team_member', 'active'),
      ('${WS}', '${B}', 'team_member', 'active'),
      ('${WS}', '${VIEWER}', 'collaborator', 'active');
  `);
}, 120_000);

/** Runs `fn` in a transaction (as the db owner) and rolls back. */
async function scenario<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.exec(
      `insert into public.tasks (id, workspace_id, title, created_by) values ('${TASK}', '${WS}', 'T', '${OWNER}')`,
    );
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}

const assignees = async (): Promise<string[]> =>
  (
    await db.query<{ user_id: string }>(
      `select user_id from public.task_assignees where task_id = '${TASK}' order by user_id`,
    )
  ).rows.map((r) => r.user_id);
const primary = async () =>
  (await db.query<{ assigned_to: string | null }>(`select assigned_to from public.tasks where id = '${TASK}'`)).rows[0]
    .assigned_to;
const notified = async (uid: string) =>
  (
    await db.query<{ n: number }>(
      `select count(*)::int n from public.notifications where recipient_user_id = '${uid}' and type = 'task_assigned'`,
    )
  ).rows[0].n;
const activity = async () =>
  (
    await db.query<{ old_value: string | null; new_value: string | null }>(
      `select old_value, new_value from public.task_activity where task_id = '${TASK}' and field = 'assigned_to'`,
    )
  ).rows;

describe("task_assignees", () => {
  it("supports several assignees and keeps tasks.assigned_to as the first one", async () => {
    await scenario(async () => {
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [B, A]]);
      expect(await assignees()).toEqual([A, B].sort());
      expect([A, B]).toContain(await primary());
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A]]);
      expect(await assignees()).toEqual([A]);
      expect(await primary()).toBe(A);
      await db.query("select public.set_task_assignees($1, $2)", [TASK, []]);
      expect(await assignees()).toEqual([]);
      expect(await primary()).toBeNull();
    });
  });

  it("notifies each new assignee exactly once, and nobody on unchanged saves", async () => {
    await scenario(async () => {
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A, B]]);
      expect(await notified(A)).toBe(1);
      expect(await notified(B)).toBe(1);
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A, B]]);
      expect(await notified(A)).toBe(1);
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A]]);
      expect(await notified(B)).toBe(1);
    });
  });

  it("logs additions and removals in the activity timeline", async () => {
    await scenario(async () => {
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A]]);
      await db.query("select public.set_task_assignees($1, $2)", [TASK, []]);
      expect(await activity()).toEqual([
        { old_value: null, new_value: A },
        { old_value: A, new_value: null },
      ]);
    });
  });

  it("legacy inserts and updates of tasks.assigned_to add an assignee", async () => {
    await scenario(async () => {
      await db.exec(
        `insert into public.tasks (id, workspace_id, title, assigned_to)
         values ('00000000-0000-4000-8000-00000000d002', '${WS}', 'L', '${A}')`,
      );
      const { rows: r } = await db.query<{ user_id: string }>(
        `select user_id from public.task_assignees where task_id = '00000000-0000-4000-8000-00000000d002'`,
      );
      expect(r.map((x) => x.user_id)).toEqual([A]);
      await db.exec(`update public.tasks set assigned_to = '${B}' where id = '${TASK}'`);
      expect(await assignees()).toEqual([B]);
      expect(await notified(B)).toBe(1);
    });
  });

  it("deleting a task cascades without errors", async () => {
    await scenario(async () => {
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A, B]]);
      await db.exec(`delete from public.tasks where id = '${TASK}'`);
      expect(await assignees()).toEqual([]);
    });
  });

  it("recurring rules assign every assignee of the rule", async () => {
    await scenario(async () => {
      await db.exec(
        `insert into public.task_recurrence_rules (workspace_id, title, frequency, next_run_date, assignee_ids)
         values ('${WS}', 'Weekly', 'weekly', current_date, array['${A}','${B}']::uuid[])`,
      );
      await db.exec("select public.generate_recurring_tasks()");
      const { rows: r } = await db.query<{ n: number }>(
        `select count(*)::int n from public.task_assignees a join public.tasks t on t.id = a.task_id where t.title = 'Weekly'`,
      );
      expect(r[0].n).toBe(2);
    });
  });
});

/** Committed fixture (RLS checks open their own transactions), removed afterwards. */
async function committed<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `insert into public.tasks (id, workspace_id, title, created_by) values ('${TASK}', '${WS}', 'T', '${OWNER}')`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`delete from public.tasks where id = '${TASK}'`);
  }
}

describe("task_assignees RLS", () => {
  it("members see assignees, outsiders do not", async () => {
    await committed(async () => {
      await db.exec(`insert into public.task_assignees (task_id, user_id) values ('${TASK}', '${A}')`);
      const q = `select user_id from public.task_assignees where task_id = '${TASK}'`;
      expect((await rows(db, user(B), q)).length).toBe(1);
      expect((await rows(db, user(OUTSIDER), q)).length).toBe(0);
    });
  });

  it("writers and assignees can change assignees; plain members and outsiders cannot", async () => {
    await committed(async () => {
      await db.exec(`insert into public.task_assignees (task_id, user_id) values ('${TASK}', '${A}')`);
      const add = (uid: string) => `insert into public.task_assignees (task_id, user_id) values ('${TASK}', '${uid}')`;
      expect(await denied(db, user(OWNER), add(B))).toBeNull(); // writer
      expect(await denied(db, user(A), add(VIEWER))).toBeNull(); // current assignee
      expect(await denied(db, user(OUTSIDER), add(OUTSIDER))).not.toBeNull();
      const del = (uid: string) =>
        `delete from public.task_assignees where task_id = '${TASK}' and user_id = '${uid}'`;
      expect(await affected(db, user(OUTSIDER), del(A))).toBe(0);
      expect(await affected(db, user(A), del(A))).toBe(1);
    });
  });

  it("a non-writer who is not an assignee cannot add themselves", async () => {
    await committed(async () => {
      const add = `insert into public.task_assignees (task_id, user_id) values ('${TASK}', '${VIEWER}')`;
      expect(await denied(db, user(VIEWER), add)).not.toBeNull();
    });
  });

  it("any assignee (not only the primary) may update the task; others may not", async () => {
    await committed(async () => {
      await db.query("select public.set_task_assignees($1, $2)", [TASK, [A]]);
      await db.exec(`insert into public.task_assignees (task_id, user_id) values ('${TASK}', '${VIEWER}')`);
      expect(await primary()).toBe(A);
      const upd = `update public.tasks set title = 'X' where id = '${TASK}'`;
      expect(await affected(db, user(VIEWER), upd)).toBe(1); // secondary assignee
      expect(await affected(db, user(OUTSIDER), upd)).toBe(0);
    });
  });
});

void as;
