import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Canonical production origin. We deliberately do NOT trust a stray Lovable
// value that might come in via SITE_URL — this is a browser redirect target
// after Google OAuth, and sending the user to a dead domain silently breaks
// the "connect calendar" flow. Same pattern as send-content-approval-request.
const PROD_ORIGIN = "https://app.astrattaagency.com";
let APP_URL = (Deno.env.get("SITE_URL") ?? PROD_ORIGIN).replace(/\/$/, "");
if (APP_URL.includes("lovable")) APP_URL = PROD_ORIGIN;

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function redirectTo(status: string, msg?: string) {
  const u = new URL(`${APP_URL}/app/configuracion`);
  u.searchParams.set("google_calendar", status);
  if (msg) u.searchParams.set("gc_msg", msg);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirectTo("error", errorParam);
  if (!code || !state) return redirectTo("error", "missing_params");

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return redirectTo("error", "server_not_configured");

  const [payloadStr, sig] = state.split(".");
  if (!payloadStr || !sig) return redirectTo("error", "bad_state");

  const expectedSig = await hmacSign(payloadStr, clientSecret);
  if (expectedSig !== sig) return redirectTo("error", "bad_state_sig");

  let payload: { uid: string; wid: string; ts: number };
  try {
    payload = JSON.parse(atob(payloadStr));
  } catch {
    return redirectTo("error", "bad_state_payload");
  }
  if (Date.now() - payload.ts > 10 * 60 * 1000) return redirectTo("error", "state_expired");

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("token exchange failed", await tokenRes.text());
    return redirectTo("error", "token_exchange_failed");
  }

  const tokens = await tokenRes.json();

  let googleEmail: string | null = null;
  try {
    const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (uiRes.ok) {
      const ui = await uiRes.json();
      googleEmail = ui.email ?? null;
    }
  } catch (_e) {
    // non-fatal
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: existing } = await admin
    .from("google_calendar_connections")
    .select("id, refresh_token, google_calendar_id")
    .eq("user_id", payload.uid)
    .eq("workspace_id", payload.wid)
    .maybeSingle();

  const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null;
  if (!refreshToken) {
    return redirectTo("error", "no_refresh_token");
  }

  let calendarId: string | null = existing?.google_calendar_id ?? null;

  if (calendarId) {
    const chk = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!chk.ok) calendarId = null;
  }

  if (!calendarId) {
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (listRes.ok) {
      const list = await listRes.json();
      const found = (list.items ?? []).find(
        (c: { summary?: string; id: string }) => c.summary === "Astratta OS – Contenido y Tareas",
      );
      if (found) calendarId = found.id;
    }
  }

  if (!calendarId) {
    const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "Astratta OS – Contenido y Tareas", timeZone: "America/Chicago" }),
    });
    if (!createRes.ok) {
      console.error("calendar create failed", await createRes.text());
      return redirectTo("error", "calendar_create_failed");
    }
    const created = await createRes.json();
    calendarId = created.id;
  }

  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const { error: upsertErr } = await admin
    .from("google_calendar_connections")
    .upsert(
      {
        user_id: payload.uid,
        workspace_id: payload.wid,
        google_email: googleEmail,
        google_calendar_id: calendarId,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        last_error: null,
        sync_next_token: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,workspace_id" },
    );

  if (upsertErr) {
    console.error("upsert failed", upsertErr);
    return redirectTo("error", "db_upsert_failed");
  }

  return redirectTo("connected");
});
