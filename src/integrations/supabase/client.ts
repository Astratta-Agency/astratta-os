import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — bring-your-own project.
 *
 * The URL and anon (publishable) key are safe to expose in the browser; protection
 * relies on Row-Level Security policies in the Supabase project.
 *
 * Configure them via Vite env vars:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
