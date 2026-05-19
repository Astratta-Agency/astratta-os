import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PortalClient = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  industry: string | null;
};

export type PortalClientUser = {
  id: string;
  client_id: string;
  user_id: string;
  role: "client_admin" | "client_viewer";
  status: "invited" | "active" | "revoked";
  accepted_at: string | null;
  invited_email: string | null;
};

export type PortalContext = {
  client: PortalClient;
  currentClientUser: PortalClientUser;
  role: "client_admin" | "client_viewer";
};

export function useClientPortalContext(slug: string | undefined) {
  const { user } = useAuth();

  return useQuery<PortalContext>({
    queryKey: ["portal-context", slug, user?.id],
    enabled: !!slug && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: client, error: cErr } = await (supabase as any)
        .from("clients")
        .select(
          "id, workspace_id, name, slug, logo_url, brand_primary_color, brand_secondary_color, industry",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!client) throw new Error("client_not_found");

      const { data: cu, error: cuErr } = await (supabase as any)
        .from("client_users")
        .select("id, client_id, user_id, role, status, accepted_at, invited_email")
        .eq("client_id", client.id)
        .eq("user_id", user!.id)
        .in("status", ["active", "invited"])
        .maybeSingle();
      if (cuErr) throw cuErr;
      if (!cu) throw new Error("not_a_member");

      return {
        client: client as PortalClient,
        currentClientUser: cu as PortalClientUser,
        role: cu.role as "client_admin" | "client_viewer",
      };
    },
  });
}
