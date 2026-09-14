import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase client — bring-your-own project.
 *
 * The URL and anon (publishable) key are safe to expose in the browser; protection
 * relies on Row-Level Security policies in the Supabase project. They still come
 * from the environment (not source) so dev/staging/prod can point at different
 * Supabase projects and so the anon key can rotate without a code change.
 *
 * Required at build time — set these in `.env.local` for local dev (see
 * `.env.example`) and in the Vercel project's Environment Variables for every
 * deployed environment. Vite only exposes vars prefixed `VITE_` to client code.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "The app will run in a degraded, logged-out state — see .env.example.",
  );
}

// createClient() throws on a falsy URL, and runs at module load regardless of
// isSupabaseConfigured, so every importer of this file would crash instead of
// getting the graceful "not configured" state the rest of the app expects.
// A syntactically valid placeholder keeps the client constructible; every real
// request against it fails closed (unreachable host), and every consumer is
// expected to check isSupabaseConfigured — or the auth guards, which fail
// closed too — before relying on it.
const supabaseUrl = SUPABASE_URL ?? "https://not-configured.supabase.co";
const supabaseAnonKey = SUPABASE_ANON_KEY ?? "not-configured";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
