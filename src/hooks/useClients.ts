import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClientStatus = "prospect" | "active" | "paused" | "churned";
export type ProjectType =
  | "web_dev"
  | "social_media"
  | "paid_ads"
  | "graphic_design"
  | "branding"
  | "audit";

export type ClientRow = {
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
  created_at: string;
  projects: { id: string; type: ProjectType; status: string }[];
};

export type ClientsFilters = {
  search?: string;
  status?: ClientStatus | "all";
  industry?: string | "all";
  location?: string | "all";
};


export function useClients(workspaceId: string | undefined, filters: ClientsFilters) {
  return useQuery<ClientRow[]>({
    queryKey: ["clients", workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("clients")
        .select(
          "id, workspace_id, name, slug, industry, location, website, status, health_score, logo_url, brand_primary_color, brand_secondary_color, created_at, projects(id, type, status)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (filters.search?.trim()) q = q.ilike("name", `%${filters.search.trim()}%`);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.industry && filters.industry !== "all") q = q.eq("industry", filters.industry);
      if (filters.location && filters.location !== "all") q = q.eq("location", filters.location);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type NewClientInput = {
  name: string;
  industry: string;
  website?: string;
  location: string;
  status: ClientStatus;
  brand_primary_color?: string;
  brand_secondary_color?: string;
  logo_url?: string;
  contact: { name: string; email: string; phone?: string; role?: string };
};

export function useCreateClient(workspaceId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewClientInput) => {
      if (!workspaceId) throw new Error("No workspace activo");

      const base = slugify(input.name) || "cliente";
      const { data: existing } = await (supabase as any)
        .from("clients")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .ilike("slug", `${base}%`);
      const taken = new Set((existing ?? []).map((r: any) => r.slug));
      let slug = base;
      let n = 2;
      while (taken.has(slug)) slug = `${base}-${n++}`;

      const { data: client, error: cErr } = await (supabase as any)
        .from("clients")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          slug,
          industry: input.industry,
          website: input.website || null,
          location: input.location,
          status: input.status,
          logo_url: input.logo_url || null,
          brand_primary_color: input.brand_primary_color || "#5140f2",
          brand_secondary_color: input.brand_secondary_color || "#ff7503",
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const { error: ctErr } = await (supabase as any).from("client_contacts").insert({
        client_id: client.id,
        name: input.contact.name,
        email: input.contact.email,
        phone: input.contact.phone || null,
        role: input.contact.role || null,
        is_primary: true,
      });
      if (ctErr) throw ctErr;

      // Best-effort: copy workspace default pillars to the new client.
      try {
        const { data: defaults } = await (supabase as any)
          .from("workspace_default_pillars")
          .select("name, color, description, sort_order")
          .eq("workspace_id", workspaceId)
          .order("sort_order", { ascending: true });
        if (defaults && defaults.length > 0) {
          const rows = defaults.map((d: any) => ({
            client_id: client.id,
            name: d.name,
            color: d.color,
            description: d.description ?? null,
            sort_order: d.sort_order,
          }));
          const { error: pErr } = await (supabase as any).from("content_pillars").insert(rows);
          if (pErr) console.error("Failed to copy default pillars", pErr);
        }
      } catch (e) {
        console.error("Failed to copy default pillars", e);
      }

      return client as { id: string; slug: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export type UpdateClientInput = {
  name: string;
  industry: string;
  website?: string;
  location: string;
  status: ClientStatus;
  brand_primary_color?: string;
  brand_secondary_color?: string;
  logo_url?: string;
};

export function useUpdateClient(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; patch: UpdateClientInput }) => {
      const { error } = await (supabase as any)
        .from("clients")
        .update({
          name: input.patch.name,
          industry: input.patch.industry,
          website: input.patch.website || null,
          location: input.patch.location,
          status: input.patch.status,
          brand_primary_color: input.patch.brand_primary_color || null,
          brand_secondary_color: input.patch.brand_secondary_color || null,
          logo_url: input.patch.logo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      qc.invalidateQueries({ queryKey: ["client-timeline"] });
    },
  });
}

export function useArchiveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await (supabase as any)
        .from("clients")
        .update({ status: "churned", updated_at: new Date().toISOString() })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      qc.invalidateQueries({ queryKey: ["client-timeline"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await (supabase as any).from("clients").delete().eq("id", clientId);
      if (error) {
        const code = (error as any)?.code;
        if (code === "23503") {
          const friendly = new Error(
            "Este cliente tiene facturas o pagos registrados y no se puede eliminar. Archívalo en su lugar (estado → churned).",
          ) as Error & { code?: string };
          friendly.code = code;
          throw friendly;
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
