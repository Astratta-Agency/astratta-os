import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientStatus, ProjectType } from "@/hooks/useClients";

export type ClientContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
};

export type ClientProject = {
  id: string;
  name: string;
  type: ProjectType;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  retainer_monthly: boolean;
};

export type ClientDetail = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  industry: string | null;
  location: string;
  website: string | null;
  status: ClientStatus;
  health_score: number | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  notes_internal: string | null;
  created_at: string;
  client_contacts: ClientContact[];
  projects: ClientProject[];
};

export function useClient(workspaceId: string | undefined, slug: string | undefined) {
  return useQuery<ClientDetail | null>({
    queryKey: ["client", workspaceId, slug],
    enabled: !!workspaceId && !!slug,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select(
          "id, workspace_id, name, slug, industry, location, website, status, health_score, logo_url, brand_primary_color, brand_secondary_color, notes_internal, created_at, client_contacts(id, name, email, phone, role, is_primary), projects(id, name, type, status, start_date, end_date, budget_amount, retainer_monthly)",
        )
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as ClientDetail | null;
    },
  });
}

// ---------------- Notes ----------------
export function useClientNotes(clientId: string | undefined) {
  return useQuery<{ body_md: string; updated_at: string | null }>({
    queryKey: ["client-notes", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_notes")
        .select("body_md, updated_at")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return { body_md: data?.body_md ?? "", updated_at: data?.updated_at ?? null };
    },
  });
}

export function useSaveClientNotes(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body_md: string) => {
      if (!clientId) throw new Error("clientId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("client_notes")
        .upsert(
          { client_id: clientId, body_md, updated_by: userRes.user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: "client_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
    },
  });
}

// ---------------- Timeline ----------------
export type TimelineEvent = {
  id: string;
  event_type:
    | "client_created"
    | "client_updated"
    | "project_created"
    | "project_status_changed"
    | "contact_added"
    | "contact_updated"
    | "note_updated"
    | "manual";
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  occurred_at: string;
};

export type TimelineFilter = "all" | "projects" | "contacts" | "notes" | "client" | "manual";

const filterMap: Record<TimelineFilter, string[] | null> = {
  all: null,
  projects: ["project_created", "project_status_changed"],
  contacts: ["contact_added", "contact_updated"],
  notes: ["note_updated"],
  client: ["client_created", "client_updated"],
  manual: ["manual"],
};

export function useClientTimeline(clientId: string | undefined, filter: TimelineFilter = "all") {
  return useQuery<TimelineEvent[]>({
    queryKey: ["client-timeline", clientId, filter],
    enabled: !!clientId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("client_timeline_events")
        .select("id, event_type, title, description, metadata, actor_id, occurred_at")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      const types = filterMap[filter];
      if (types) q = q.in("event_type", types);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });
}

export function useCreateManualEvent(clientId: string | undefined, workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; occurred_at?: string }) => {
      if (!clientId || !workspaceId) throw new Error("Faltan ids");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("client_timeline_events").insert({
        client_id: clientId,
        workspace_id: workspaceId,
        event_type: "manual",
        title: input.title,
        description: input.description || null,
        occurred_at: input.occurred_at || new Date().toISOString(),
        actor_id: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
    },
  });
}

// ---------------- Project create ----------------
export type NewProjectInput = {
  name: string;
  type: ProjectType;
  start_date?: string;
  end_date?: string;
  budget_amount?: number;
  retainer_monthly?: boolean;
  description?: string;
};

export function useCreateProject(workspaceId: string | undefined, clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewProjectInput) => {
      if (!workspaceId || !clientId) throw new Error("Faltan ids");
      const { error, data } = await (supabase as any)
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          client_id: clientId,
          name: input.name,
          type: input.type,
          status: "planning",
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          budget_amount: input.budget_amount ?? null,
          retainer_monthly: input.retainer_monthly ?? false,
          description: input.description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client"] });
      qc.invalidateQueries({ queryKey: ["client-timeline"] });
    },
  });
}

// ---------------- Portal invites ----------------
export type ClientUserRole = "client_admin" | "client_viewer";

export type PendingInvite = {
  id: string;
  invited_email: string;
  role: ClientUserRole;
  invited_at: string | null;
};

export function useInviteClientUser(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: ClientUserRole;
      welcome_message?: string;
    }): Promise<{ emailed: boolean }> => {
      if (!clientId) throw new Error("clientId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("client_users").insert({
        client_id: clientId,
        invited_email: input.email.toLowerCase().trim(),
        role: input.role,
        welcome_message: input.welcome_message || null,
        status: "invited",
        invited_by: userRes.user?.id ?? null,
        invited_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Send invitation email via Amazon SES (Edge Function). On failure the
      // dialog falls back to "copy link" flow.
      let emailed = false;
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("send-portal-invite", {
          body: {
            client_id: clientId,
            email: input.email.toLowerCase().trim(),
            welcome_message: input.welcome_message ?? null,
          },
        });
        if (!fnErr && (data as any)?.emailed) emailed = true;
      } catch (e) {
        console.warn("[useInviteClientUser] send-portal-invite failed", e);
      }
      return { emailed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-invites", clientId] });
    },
  });
}

export function usePendingInvites(clientId: string | undefined) {
  return useQuery<PendingInvite[]>({
    queryKey: ["client-invites", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_users")
        .select("id, invited_email, role, invited_at")
        .eq("client_id", clientId)
        .eq("status", "invited")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingInvite[];
    },
  });
}

export function useRevokeInvite(clientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await (supabase as any)
        .from("client_users")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-invites", clientId] });
    },
  });
}

// ---------------- Tasks (Resumen KPI) ----------------
export function useClientPendingTasksCount(clientId: string | undefined) {
  return useQuery<number>({
    queryKey: ["client-pending-tasks", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", ["todo", "doing", "review"]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
