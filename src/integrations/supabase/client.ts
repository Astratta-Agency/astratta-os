import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Supabase client — bring-your-own project.
 *
 * The URL and anon (publishable) key are safe to expose in the browser; protection
 * relies on Row-Level Security policies in the Supabase project.
 */
const SUPABASE_URL = "https://vdnblnrwkkychxzbixam.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MFPp01GR2S8XqWsiuxtJnw_EuJ4L4S5";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
