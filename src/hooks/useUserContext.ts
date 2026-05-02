import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type WorkspaceMembership = {
  workspace_id: string;
  role: "owner" | "team_member" | "collaborator";
  workspace: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    onboarded_at: string | null;
  };
};

export type ClientMembership = {
  client_id: string;
  role: "client_admin" | "client_viewer";
  client: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    workspace_id: string;
  };
};

export type UserContext = {
  workspaces: WorkspaceMembership[];
  clients: ClientMembership[];
};

export function useUserContext() {
  const { user } = useAuth();

  return useQuery<UserContext>({
    queryKey: ["user-context", user?.id],
    enabled: !!user?.id && isSupabaseConfigured,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return { workspaces: [], clients: [] };

      const [{ data: wm, error: wmErr }, { data: cu, error: cuErr }] = await Promise.all([
        supabase
          .from("workspace_members")
          .select(
            "workspace_id, role, workspace:workspaces!inner(id, name, slug, logo_url, onboarded_at)",
          )
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("client_users")
          .select(
            "client_id, role, client:clients!inner(id, name, slug, logo_url, workspace_id)",
          )
          .eq("user_id", user.id),
      ]);

      if (wmErr) throw wmErr;
      if (cuErr) throw cuErr;

      return {
        workspaces: (wm ?? []) as unknown as WorkspaceMembership[],
        clients: (cu ?? []) as unknown as ClientMembership[],
      };
    },
  });
}
