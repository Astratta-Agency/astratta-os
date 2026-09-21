import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_CRON_SECRET") ?? "";

// Canonical production origin, embedded in every synced event's description
// as a link back into the app. Same pattern as send-content-approval-request
// and google-calendar-oauth-callback — never let a stray Lovable value leak
// into a link a user might click from inside Google Calendar.
const PROD_ORIGIN = "https://app.astrattaagency.com";
let APP_URL = (Deno.env.get("SITE_URL") ?? PROD_ORIGIN).replace(/\/$/, "");
if (APP_URL.includes("lovable")) APP_URL = PROD_ORIGIN;

// Edge functions are killed at ~150s. Stop starting new work before that so a
// run never dies between "create event in Google" and "record it in sync_map".
const TIME_BUDGET_MS = 110_000;
let DEADLINE = 0;
const outOfTime = () => Date.now() > DEADLINE;

// Marker present in every description we write; used to recognise our own events.
const EVENT_MARKER = "Astratta OS —";

const PRIORITY_COLOR: Record<string, string> = { p0: "11", p1: "6", p2: "5", p3: "8" };

function hashOf(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

// deno-lint-ignore no-explicit-any
async function getValidAccessToken(admin: any, conn: any): Promise<string> {
  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return conn.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 400 || res.status === 401) {
      await admin
        .from("google_calendar_connections")
        .update({ is_active: false, last_error: "refresh_token_invalid" })
        .eq("id", conn.id);
    }
    throw new Error(`token_refresh_failed:${res.status}:${t}`);
  }

  const json = await res.json();
  const newExpiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("google_calendar_connections")
    .update({ access_token: json.access_token, token_expires_at: newExpiresAt })
    .eq("id", conn.id);
  conn.access_token = json.access_token;
  conn.token_expires_at = newExpiresAt;
  return json.access_token;
}

// Deterministic Google event id (lowercase hex is valid: a-v, 0-9, 5-1024 chars).
// Creating the same entity twice hits a 409 instead of producing a duplicate,
// even if a previous run died before writing sync_map or two runs overlap.
async function eventIdFor(connectionId: string, entityType: string, entityId: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${connectionId}:${entityType}:${entityId}`),
  );
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function createEvent(
  admin: any,
  gcalBase: string,
  accessToken: string,
  connectionId: string,
  entityType: string,
  entityId: string,
  // deno-lint-ignore no-explicit-any
  eventBody: any,
  hash: string,
) {
  const id = await eventIdFor(connectionId, entityType, entityId);
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  let res = await fetch(`${gcalBase}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...eventBody, id }),
  });
  if (res.status === 409) {
    // Already exists (orphan from an earlier run, or deleted in Google): adopt/restore it.
    res = await fetch(`${gcalBase}/events/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ...eventBody, status: "confirmed" }),
    });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`event_create_failed:${res.status}:${t}`);
  }

  const { error } = await admin.from("google_calendar_sync_map").upsert(
    {
      connection_id: connectionId,
      entity_type: entityType,
      entity_id: entityId,
      google_event_id: id,
      content_hash: hash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id,entity_type,entity_id" },
  );
  if (error) throw new Error(`sync_map_write_failed:${error.message}`);
}

// Deletes events in the dedicated calendar that carry our marker but are not in
// sync_map (duplicates left by the old non-idempotent create). Resumable: returns
// done=false when the time budget runs out, just call again.
// deno-lint-ignore no-explicit-any
async function cleanupOrphans(admin: any, gcalBase: string, accessToken: string, connectionId: string) {
  const { data: maps } = await admin
    .from("google_calendar_sync_map")
    .select("google_event_id")
    .eq("connection_id", connectionId);
  // deno-lint-ignore no-explicit-any
  const known = new Set((maps ?? []).map((m: any) => m.google_event_id));

  let deleted = 0;
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${gcalBase}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`cleanup_list_failed:${res.status}`);
    const json = await res.json();
    // deno-lint-ignore no-explicit-any
    for (const ev of (json.items ?? []) as any[]) {
      if (known.has(ev.id)) continue;
      if (!(ev.description ?? "").includes(EVENT_MARKER)) continue;
      if (outOfTime()) return { deleted, done: false };
      const del = await fetch(`${gcalBase}/events/${ev.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (del.ok || del.status === 410) deleted++;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return { deleted, done: true };
}

async function deleteEvent(gcalBase: string, accessToken: string, eventId: string) {
  await fetch(`${gcalBase}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

// deno-lint-ignore no-explicit-any
async function syncConnection(admin: any, conn: any, cleanup: boolean) {
  const accessToken = await getValidAccessToken(admin, conn);
  const calId = conn.google_calendar_id as string;
  const gcalBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}`;

  const outboundStats = { created: 0, updated: 0, deleted: 0 };
  const inboundStats = { updated: 0 };

  // ---------- OUTBOUND: tasks assigned to this user, with a due date, not done ----------
  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, description, due_date, status, priority, workspace_id")
    .eq("assigned_to", conn.user_id)
    .eq("workspace_id", conn.workspace_id)
    .not("due_date", "is", null)
    .neq("status", "done");

  const { data: taskMaps } = await admin
    .from("google_calendar_sync_map")
    .select("*")
    .eq("connection_id", conn.id)
    .eq("entity_type", "task");

  // deno-lint-ignore no-explicit-any
  const taskMapByEntity = new Map((taskMaps ?? []).map((m: any) => [m.entity_id, m]));
  const seenTaskIds = new Set<string>((tasks ?? []).map((t: { id: string }) => t.id));

  for (const task of tasks ?? []) {
    if (outOfTime()) break; // remaining tasks are picked up next cycle
    const hash = hashOf(JSON.stringify({
      title: task.title,
      due_date: task.due_date,
      priority: task.priority,
      description: task.description,
      app: APP_URL,
    }));
    const existingMap = taskMapByEntity.get(task.id) as any;
    if (existingMap && existingMap.content_hash === hash) continue;

    const eventBody = {
      summary: `✅ ${task.title}`,
      description: `${task.description ?? ""}\n\nAstratta OS — Tarea\n${APP_URL}/app/tareas?task=${task.id}`.trim(),
      start: { date: task.due_date },
      end: { date: task.due_date },
      colorId: PRIORITY_COLOR[task.priority] ?? undefined,
    };

    if (existingMap) {
      const res = await fetch(`${gcalBase}/events/${existingMap.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      if (res.ok) {
        await admin
          .from("google_calendar_sync_map")
          .update({ content_hash: hash, updated_at: new Date().toISOString() })
          .eq("id", existingMap.id);
        outboundStats.updated++;
      } else if (res.status === 404 || res.status === 410) {
        await admin.from("google_calendar_sync_map").delete().eq("id", existingMap.id);
        await createEvent(admin, gcalBase, accessToken, conn.id, "task", task.id, eventBody, hash);
        outboundStats.created++;
      }
    } else {
      await createEvent(admin, gcalBase, accessToken, conn.id, "task", task.id, eventBody, hash);
      outboundStats.created++;
    }
  }

  for (const m of taskMaps ?? []) {
    if (!seenTaskIds.has(m.entity_id)) {
      await deleteEvent(gcalBase, accessToken, m.google_event_id);
      await admin.from("google_calendar_sync_map").delete().eq("id", m.id);
      outboundStats.deleted++;
    }
  }

  // ---------- OUTBOUND: social_posts, workspace-wide, any status, with scheduled_for ----------
  const { data: posts } = await admin
    .from("social_posts")
    .select("id, title, caption, scheduled_for, status, content_pillar, channels, workspace_id")
    .eq("workspace_id", conn.workspace_id)
    .not("scheduled_for", "is", null);

  const { data: postMaps } = await admin
    .from("google_calendar_sync_map")
    .select("*")
    .eq("connection_id", conn.id)
    .eq("entity_type", "social_post");

  // deno-lint-ignore no-explicit-any
  const postMapByEntity = new Map((postMaps ?? []).map((m: any) => [m.entity_id, m]));
  const seenPostIds = new Set<string>((posts ?? []).map((p: { id: string }) => p.id));

  for (const post of posts ?? []) {
    if (outOfTime()) break; // remaining posts are picked up next cycle
    const hash = hashOf(JSON.stringify({
      title: post.title,
      scheduled_for: post.scheduled_for,
      status: post.status,
      channels: post.channels,
      app: APP_URL,
    }));
    const existingMap = postMapByEntity.get(post.id) as any;
    if (existingMap && existingMap.content_hash === hash) continue;

    const start = new Date(post.scheduled_for);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const channelsStr = (post.channels ?? []).join(", ");

    const eventBody = {
      summary: `📱 ${post.title}${channelsStr ? ` (${channelsStr})` : ""}`,
      description: `${post.caption ?? ""}\n\nPilar: ${post.content_pillar ?? "-"}\nEstado: ${post.status}\n\nAstratta OS — Calendario de contenido\n${APP_URL}/app/calendario?post=${post.id}`.trim(),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      colorId: "9",
    };

    if (existingMap) {
      const res = await fetch(`${gcalBase}/events/${existingMap.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      if (res.ok) {
        await admin
          .from("google_calendar_sync_map")
          .update({ content_hash: hash, updated_at: new Date().toISOString() })
          .eq("id", existingMap.id);
        outboundStats.updated++;
      } else if (res.status === 404 || res.status === 410) {
        await admin.from("google_calendar_sync_map").delete().eq("id", existingMap.id);
        await createEvent(admin, gcalBase, accessToken, conn.id, "social_post", post.id, eventBody, hash);
        outboundStats.created++;
      }
    } else {
      await createEvent(admin, gcalBase, accessToken, conn.id, "social_post", post.id, eventBody, hash);
      outboundStats.created++;
    }
  }

  for (const m of postMaps ?? []) {
    if (!seenPostIds.has(m.entity_id)) {
      await deleteEvent(gcalBase, accessToken, m.google_event_id);
      await admin.from("google_calendar_sync_map").delete().eq("id", m.id);
      outboundStats.deleted++;
    }
  }

  // ---------- INBOUND: pick up date moves / deletions made directly in Google Calendar ----------
  let pageToken: string | undefined;
  let syncToken: string | undefined = conn.sync_next_token ?? undefined;
  let newSyncToken: string | undefined;
  // deno-lint-ignore no-explicit-any
  const changedEvents: any[] = [];

  try {
    do {
      const params = new URLSearchParams({ singleEvents: "true" });
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        params.set("timeMin", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
        params.set("showDeleted", "true");
      }
      if (pageToken) params.set("pageToken", pageToken);

      const listRes = await fetch(`${gcalBase}/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        if (listRes.status === 410) {
          syncToken = undefined;
          await admin.from("google_calendar_connections").update({ sync_next_token: null }).eq("id", conn.id);
          break;
        }
        throw new Error(`events_list_failed:${listRes.status}`);
      }

      const json = await listRes.json();
      changedEvents.push(...(json.items ?? []));
      pageToken = json.nextPageToken;
      if (json.nextSyncToken) newSyncToken = json.nextSyncToken;
    } while (pageToken);
  } catch (e) {
    console.error("inbound list failed", e);
  }

  if (changedEvents.length) {
    const allMaps = [...(taskMaps ?? []), ...(postMaps ?? [])];
    // deno-lint-ignore no-explicit-any
    const mapByEventId = new Map(allMaps.map((m: any) => [m.google_event_id, m]));

    for (const ev of changedEvents) {
      const map = mapByEventId.get(ev.id) as any;
      if (!map) continue; // event not created by Astratta OS — out of scope, ignore

      if (ev.status === "cancelled") {
        await admin.from("google_calendar_sync_map").delete().eq("id", map.id);
        continue;
      }

      const newStartDate: string | null = ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
      if (!newStartDate) continue;

      if (map.entity_type === "task") {
        const { data: t } = await admin.from("tasks").select("due_date").eq("id", map.entity_id).maybeSingle();
        if (t && t.due_date !== newStartDate) {
          await admin.from("tasks").update({ due_date: newStartDate }).eq("id", map.entity_id);
          inboundStats.updated++;
        }
      } else if (map.entity_type === "social_post") {
        const newDateTime = ev.start?.dateTime ?? `${newStartDate}T00:00:00Z`;
        const { data: p } = await admin
          .from("social_posts")
          .select("scheduled_for")
          .eq("id", map.entity_id)
          .maybeSingle();
        if (p && new Date(p.scheduled_for).getTime() !== new Date(newDateTime).getTime()) {
          await admin.from("social_posts").update({ scheduled_for: newDateTime }).eq("id", map.entity_id);
          inboundStats.updated++;
        }
      }
    }
  }

  await admin
    .from("google_calendar_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: null,
      sync_next_token: newSyncToken ?? conn.sync_next_token,
    })
    .eq("id", conn.id);

  const cleanupStats = cleanup ? await cleanupOrphans(admin, gcalBase, accessToken, conn.id) : undefined;

  return { outbound: outboundStats, inbound: inboundStats, cleanup: cleanupStats };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null);

  const provided = req.headers.get("X-Sync-Secret");
  if (!SYNC_SECRET || provided !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  DEADLINE = Date.now() + TIME_BUDGET_MS;
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const cleanup = body?.cleanup === true;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: connections, error: connErr } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("is_active", true);

  if (connErr) {
    return new Response(JSON.stringify({ error: connErr.message }), { status: 500 });
  }

  // deno-lint-ignore no-explicit-any
  const results: any[] = [];

  for (const conn of connections ?? []) {
    try {
      const result = await syncConnection(admin, conn, cleanup);
      results.push({ connection_id: conn.id, ...result });
    } catch (e) {
      console.error("sync error for connection", conn.id, e);
      await admin
        .from("google_calendar_connections")
        .update({ last_error: String(e).slice(0, 500) })
        .eq("id", conn.id);
      results.push({ connection_id: conn.id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, synced: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
