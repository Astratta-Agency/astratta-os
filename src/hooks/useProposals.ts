import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ServicePriceType } from "@/hooks/useWorkspaceSettings";

export type ProposalType = "web" | "social" | "ads" | "branding" | "bundle";
export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "negotiation"
  | "signed"
  | "rejected"
  | "expired";

export const PROPOSAL_TYPE_LABEL: Record<ProposalType, string> = {
  web: "Web",
  social: "Social",
  ads: "Ads",
  branding: "Branding",
  bundle: "Bundle",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  negotiation: "Negociación",
  signed: "Firmada",
  rejected: "Rechazada",
  expired: "Vencida",
};

// ---------------- Content blocks ----------------

export type BlockText = { type: "text"; id: string; title: string; body: string };
export type BlockServices = {
  type: "services";
  id: string;
  title: string;
  items: Array<{
    service_id: string | null;
    name: string;
    description: string;
    price: number | null;
    price_type: ServicePriceType | null;
  }>;
};
export type BlockDeliverables = {
  type: "deliverables";
  id: string;
  title: string;
  items: Array<{ label: string }>;
};
export type BlockTimeline = {
  type: "timeline";
  id: string;
  title: string;
  items: Array<{ name: string; when: string }>;
};
export type BlockPricing = {
  type: "pricing";
  id: string;
  title: string;
  items: Array<{ name: string; quantity: number; unit_price: number }>;
};

export type ProposalBlock =
  | BlockText
  | BlockServices
  | BlockDeliverables
  | BlockTimeline
  | BlockPricing;

export function blockSubtotal(b: ProposalBlock): number {
  if (b.type !== "pricing") return 0;
  return b.items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  );
}

export function computeTotal(content: ProposalBlock[]): number {
  return content.reduce((acc, b) => acc + blockSubtotal(b), 0);
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function defaultContentForType(type: ProposalType): ProposalBlock[] {
  switch (type) {
    case "web":
      return [
        {
          type: "text",
          id: uid(),
          title: "Contexto",
          body: "Presupuesto para el diseño y desarrollo de un nuevo sitio web enfocado en performance y conversión.",
        },
        {
          type: "services",
          id: uid(),
          title: "Servicios incluidos",
          items: [],
        },
        {
          type: "pricing",
          id: uid(),
          title: "Inversión",
          items: [{ name: "Proyecto llave en mano", quantity: 1, unit_price: 0 }],
        },
      ];
    case "social":
      return [
        {
          type: "text",
          id: uid(),
          title: "Propuesta",
          body: "Gestión integral de redes sociales con foco en crecimiento orgánico y consistencia de marca.",
        },
        {
          type: "services",
          id: uid(),
          title: "Servicios incluidos",
          items: [],
        },
        {
          type: "pricing",
          id: uid(),
          title: "Fee mensual",
          items: [{ name: "Retainer mensual", quantity: 1, unit_price: 0 }],
        },
      ];
    case "ads":
      return [
        {
          type: "text",
          id: uid(),
          title: "Propuesta",
          body: "Gestión de campañas de performance en Meta y Google Ads.",
        },
        {
          type: "services",
          id: uid(),
          title: "Servicios",
          items: [
            { name: "Setup y estrategia", description: "Pixel, conversiones, estructura de campañas." },
            { name: "Gestión mensual", description: "Optimización continua y creative testing." },
          ],
        },
        {
          type: "pricing",
          id: uid(),
          title: "Fee de gestión",
          items: [{ name: "Fee mensual", quantity: 1, unit_price: 0 }],
        },
      ];
    case "branding":
      return [
        {
          type: "text",
          id: uid(),
          title: "Propuesta",
          body: "Desarrollo integral de identidad de marca.",
        },
        {
          type: "deliverables",
          id: uid(),
          title: "Entregables",
          items: [
            { label: "Logotipo principal y variantes" },
            { label: "Sistema tipográfico y de color" },
            { label: "Brand guidelines (PDF)" },
          ],
        },
        {
          type: "pricing",
          id: uid(),
          title: "Inversión",
          items: [{ name: "Proyecto de branding", quantity: 1, unit_price: 0 }],
        },
      ];
    case "bundle":
    default:
      return [
        {
          type: "text",
          id: uid(),
          title: "Propuesta integral",
          body: "Combo de servicios adaptado a los objetivos del negocio.",
        },
        {
          type: "services",
          id: uid(),
          title: "Servicios incluidos",
          items: [],
        },
        {
          type: "pricing",
          id: uid(),
          title: "Inversión total",
          items: [{ name: "Bundle", quantity: 1, unit_price: 0 }],
        },
      ];
  }
}

// ---------------- Types ----------------

export type ProposalRow = {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  title: string;
  type: ProposalType;
  status: ProposalStatus;
  currency: string;
  total_amount: number;
  valid_until: string | null;
  content: ProposalBlock[];
  public_token: string;
  version: number;
  parent_proposal_id: string | null;
  created_by: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalTemplateRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: ProposalType;
  content: ProposalBlock[];
  created_by: string | null;
  created_at: string;
};

export type ProposalEventRow = {
  id: string;
  proposal_id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
};

export type ProposalSignatureRow = {
  id: string;
  proposal_id: string;
  signer_name: string;
  signer_email: string | null;
  signature_data_url: string;
  consent_text: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
};

// ---------------- Queries ----------------

export function useProposalsForLead(leadId: string | undefined) {
  return useQuery<ProposalRow[]>({
    queryKey: ["proposals", "lead", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposals")
        .select("*")
        .eq("lead_id", leadId)
        .order("version", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        content: Array.isArray(r.content) ? r.content : [],
      })) as ProposalRow[];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery<ProposalRow | null>({
    queryKey: ["proposal", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposals")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        content: Array.isArray(data.content) ? data.content : [],
      } as ProposalRow;
    },
  });
}

export function useProposalTemplates(workspaceId: string | undefined) {
  return useQuery<ProposalTemplateRow[]>({
    queryKey: ["proposal_templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposal_templates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        content: Array.isArray(r.content) ? r.content : [],
      })) as ProposalTemplateRow[];
    },
  });
}

export function useProposalEvents(proposalId: string | undefined) {
  return useQuery<ProposalEventRow[]>({
    queryKey: ["proposal_events", proposalId],
    enabled: !!proposalId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposal_events")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProposalEventRow[];
    },
  });
}

export function useProposalSignature(proposalId: string | undefined) {
  return useQuery<ProposalSignatureRow | null>({
    queryKey: ["proposal_signature", proposalId],
    enabled: !!proposalId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposal_signatures")
        .select("*")
        .eq("proposal_id", proposalId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProposalSignatureRow | null;
    },
  });
}

// ---------------- Mutations ----------------

export type CreateProposalInput = {
  leadId: string;
  title: string;
  type: ProposalType;
  templateId?: string | null;
  content?: ProposalBlock[];
  currency?: string;
  valid_until?: string | null;
};

export function useCreateProposal(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      if (!workspaceId) throw new Error("No workspace activo");
      let content: ProposalBlock[] = input.content ?? [];
      if (!input.content && input.templateId) {
        const { data: tpl } = await (supabase as any)
          .from("proposal_templates")
          .select("content")
          .eq("id", input.templateId)
          .maybeSingle();
        content = (tpl?.content as ProposalBlock[]) ?? defaultContentForType(input.type);
      } else if (!input.content) {
        content = defaultContentForType(input.type);
      }
      const total_amount = computeTotal(content);
      const { data, error } = await (supabase as any)
        .from("proposals")
        .insert({
          workspace_id: workspaceId,
          lead_id: input.leadId,
          title: input.title,
          type: input.type,
          content,
          currency: input.currency ?? "usd",
          total_amount,
          valid_until: input.valid_until ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalRow;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["proposals", "lead", vars.leadId] });
    },
  });
}

export type UpdateProposalPatch = Partial<{
  title: string;
  content: ProposalBlock[];
  currency: string;
  valid_until: string | null;
}>;

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      leadId: string | null;
      patch: UpdateProposalPatch;
    }) => {
      const patch: any = { ...input.patch, updated_at: new Date().toISOString() };
      if (input.patch.content) {
        patch.total_amount = computeTotal(input.patch.content);
      }
      const { error } = await (supabase as any)
        .from("proposals")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["proposal", vars.id] });
      if (vars.leadId) qc.invalidateQueries({ queryKey: ["proposals", "lead", vars.leadId] });
    },
  });
}

export function useDuplicateAsNewVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { data: orig, error: rErr } = await (supabase as any)
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (rErr) throw rErr;
      const { data, error } = await (supabase as any)
        .from("proposals")
        .insert({
          workspace_id: orig.workspace_id,
          lead_id: orig.lead_id,
          title: orig.title,
          type: orig.type,
          content: orig.content,
          currency: orig.currency,
          total_amount: orig.total_amount,
          valid_until: orig.valid_until,
          parent_proposal_id: orig.id,
          version: (orig.version ?? 1) + 1,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalRow;
    },
    onSuccess: (row) => {
      if (row?.lead_id) qc.invalidateQueries({ queryKey: ["proposals", "lead", row.lead_id] });
    },
  });
}

export function useMarkProposalSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; leadId: string | null }) => {
      const { error } = await (supabase as any)
        .from("proposals")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", input.id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["proposal", vars.id] });
      if (vars.leadId) qc.invalidateQueries({ queryKey: ["proposals", "lead", vars.leadId] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; leadId: string | null }) => {
      const { error } = await (supabase as any).from("proposals").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      if (vars.leadId) qc.invalidateQueries({ queryKey: ["proposals", "lead", vars.leadId] });
    },
  });
}

export function useCreateProposalTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; type: ProposalType; content: ProposalBlock[] }) => {
      if (!workspaceId) throw new Error("No workspace activo");
      const { data, error } = await (supabase as any)
        .from("proposal_templates")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          type: input.type,
          content: input.content,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalTemplateRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal_templates", workspaceId] });
    },
  });
}

// ---------------- Public (no auth) ----------------

export function useFetchPublicProposal(token: string | undefined) {
  return useQuery({
    queryKey: ["public_proposal", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-proposal", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        proposal: ProposalRow;
        lead: { company_name: string; contact_name: string } | null;
        signature: ProposalSignatureRow | null;
      };
    },
  });
}

export function useSignProposal() {
  return useMutation({
    mutationFn: async (input: {
      token: string;
      signer_name: string;
      signer_email?: string | null;
      signature_data_url: string;
      consent: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("sign-proposal", {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: true };
    },
  });
}
