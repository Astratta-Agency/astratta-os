import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadStage =
  | "lead"
  | "diagnostico"
  | "propuesta_enviada"
  | "negociacion"
  | "ganado"
  | "perdido";

export type LeadSource = "organic" | "referral" | "meta_ads" | "google_ads" | "other";

export const LEAD_STAGE_ORDER: LeadStage[] = [
  "lead",
  "diagnostico",
  "propuesta_enviada",
  "negociacion",
  "ganado",
  "perdido",
];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  lead: "Lead",
  diagnostico: "Diagnóstico",
  propuesta_enviada: "Propuesta enviada",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const LEAD_STAGE_DEFAULT_PROBABILITY: Record<LeadStage, number> = {
  lead: 10,
  diagnostico: 25,
  propuesta_enviada: 50,
  negociacion: 70,
  ganado: 100,
  perdido: 0,
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  organic: "Orgánico",
  referral: "Referido",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  other: "Otro",
};

export type LeadRow = {
  id: string;
  workspace_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  source: LeadSource;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  stage: LeadStage;
  estimated_value: number | null;
  probability: number;
  expected_close_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  assigned_to: string | null;
  converted_client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------- Queries ----------------

export function useLeads(
  workspaceId: string | undefined,
  filters?: { stage?: LeadStage | "all"; search?: string; assignedTo?: string },
) {
  return useQuery<LeadRow[]>({
    queryKey: ["leads", workspaceId, filters ?? {}],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });
      if (filters?.stage && filters.stage !== "all") q = q.eq("stage", filters.stage);
      if (filters?.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as LeadRow[];
      const s = filters?.search?.trim().toLowerCase();
      if (s) {
        rows = rows.filter(
          (r) =>
            r.company_name.toLowerCase().includes(s) ||
            r.contact_name.toLowerCase().includes(s) ||
            r.contact_email.toLowerCase().includes(s),
        );
      }
      return rows;
    },
  });
}

export function useLead(leadId: string | undefined) {
  return useQuery<LeadRow | null>({
    queryKey: ["lead", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LeadRow | null;
    },
  });
}

// ---------------- Mutations ----------------

export type NewLeadInput = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  source: LeadSource;
  estimated_value?: number | null;
  expected_close_date?: string | null;
  notes?: string;
};

export function useCreateLead(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLeadInput) => {
      if (!workspaceId) throw new Error("No workspace activo");
      const { data, error } = await (supabase as any)
        .from("leads")
        .insert({
          workspace_id: workspaceId,
          company_name: input.company_name,
          contact_name: input.contact_name,
          contact_email: input.contact_email,
          contact_phone: input.contact_phone || null,
          source: input.source,
          estimated_value: input.estimated_value ?? null,
          expected_close_date: input.expected_close_date || null,
          notes: input.notes || null,
          stage: "lead",
          probability: 10,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LeadRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", workspaceId] });
    },
  });
}

export type UpdateLeadPatch = Partial<
  Pick<
    LeadRow,
    | "company_name"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "source"
    | "stage"
    | "estimated_value"
    | "probability"
    | "expected_close_date"
    | "lost_reason"
    | "notes"
    | "assigned_to"
    | "converted_client_id"
  >
>;

export function useUpdateLead(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { leadId: string; patch: UpdateLeadPatch }) => {
      const patch: any = { ...input.patch, updated_at: new Date().toISOString() };
      // If stage changed but probability wasn't set explicitly in this patch,
      // apply the suggested default for the new column.
      if (patch.stage && patch.probability === undefined) {
        patch.probability = LEAD_STAGE_DEFAULT_PROBABILITY[patch.stage as LeadStage];
      }
      const { error } = await (supabase as any)
        .from("leads")
        .update(patch)
        .eq("id", input.leadId);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", workspaceId] });
      qc.invalidateQueries({ queryKey: ["lead", vars.leadId] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await (supabase as any).from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

// ---------------- Convert to client ----------------

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ConvertLeadInput = {
  leadId: string;
  workspaceId: string;
  client: {
    name: string;
    industry: string;
    website?: string;
    location: string;
    status: "prospect" | "active" | "paused" | "churned";
    brand_primary_color?: string;
    brand_secondary_color?: string;
    logo_url?: string;
    contact: { name: string; email: string; phone?: string; role?: string };
  };
};

export function useConvertLeadToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConvertLeadInput) => {
      const base = slugify(input.client.name) || "cliente";
      const { data: existing } = await (supabase as any)
        .from("clients")
        .select("slug")
        .eq("workspace_id", input.workspaceId)
        .ilike("slug", `${base}%`);
      const taken = new Set((existing ?? []).map((r: any) => r.slug));
      let slug = base;
      let n = 2;
      while (taken.has(slug)) slug = `${base}-${n++}`;

      const { data: client, error: cErr } = await (supabase as any)
        .from("clients")
        .insert({
          workspace_id: input.workspaceId,
          name: input.client.name,
          slug,
          industry: input.client.industry,
          website: input.client.website || null,
          location: input.client.location,
          status: input.client.status,
          logo_url: input.client.logo_url || null,
          brand_primary_color: input.client.brand_primary_color || "#5140f2",
          brand_secondary_color: input.client.brand_secondary_color || "#ff7503",
        })
        .select()
        .single();
      if (cErr) throw cErr;

      await (supabase as any).from("client_contacts").insert({
        client_id: client.id,
        name: input.client.contact.name,
        email: input.client.contact.email,
        phone: input.client.contact.phone || null,
        role: input.client.contact.role || null,
        is_primary: true,
      });

      // Copy default pillars — best effort.
      try {
        const { data: defaults } = await (supabase as any)
          .from("workspace_default_pillars")
          .select("name, color, description, sort_order")
          .eq("workspace_id", input.workspaceId)
          .order("sort_order", { ascending: true });
        if (defaults && defaults.length > 0) {
          const rows = defaults.map((d: any) => ({
            client_id: client.id,
            name: d.name,
            color: d.color,
            description: d.description ?? null,
            sort_order: d.sort_order,
          }));
          await (supabase as any).from("content_pillars").insert(rows);
        }
      } catch (e) {
        console.error("Failed to copy default pillars", e);
      }

      const { error: uErr } = await (supabase as any)
        .from("leads")
        .update({
          converted_client_id: client.id,
          stage: "ganado",
          probability: 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.leadId);
      if (uErr) throw uErr;

      return client as { id: string; slug: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ---------------- Diagnostics ----------------

export type DiagnosticSection = {
  key: string;
  title: string;
  score: number | null;
  notes: string;
};

export type DiagnosticRow = {
  id: string;
  workspace_id: string;
  lead_id: string;
  title: string;
  sections: DiagnosticSection[];
  overall_notes: string | null;
  is_completed: boolean;
  pdf_generated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useDiagnostics(leadId: string | undefined) {
  return useQuery<DiagnosticRow[]>({
    queryKey: ["diagnostics", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diagnostics")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        sections: Array.isArray(r.sections) ? r.sections : [],
      })) as DiagnosticRow[];
    },
  });
}

export function useCreateDiagnostic(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      leadId: string;
      title?: string;
      sections: DiagnosticSection[];
      overall_notes?: string | null;
      is_completed?: boolean;
    }) => {
      if (!workspaceId) throw new Error("No workspace activo");
      const { data, error } = await (supabase as any)
        .from("diagnostics")
        .insert({
          workspace_id: workspaceId,
          lead_id: input.leadId,
          title: input.title ?? "Diagnóstico / Auditoría",
          sections: input.sections,
          overall_notes: input.overall_notes ?? null,
          is_completed: input.is_completed ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DiagnosticRow;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["diagnostics", vars.leadId] });
    },
  });
}

export function useUpdateDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      leadId: string;
      patch: Partial<{
        title: string;
        sections: DiagnosticSection[];
        overall_notes: string | null;
        is_completed: boolean;
        pdf_generated_at: string | null;
      }>;
    }) => {
      const { error } = await (supabase as any)
        .from("diagnostics")
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["diagnostics", vars.leadId] });
    },
  });
}
