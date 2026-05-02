import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  configured: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Set up listener BEFORE getSession (per Supabase auth best practice)
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[useAuth] Auth state:", newSession ? "signed in" : "signed out", "(event:", event + ")", newSession?.user?.email ?? "");
      setSession(newSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      console.log("[useAuth] Initial getSession:", data.session ? "signed in" : "no session", data.session?.user?.email ?? "");
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return {
    loading,
    session,
    user: session?.user ?? null,
    configured: isSupabaseConfigured,
  };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}
