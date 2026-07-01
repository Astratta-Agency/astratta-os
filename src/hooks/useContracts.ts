import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PROPOSAL_TYPE_LABEL, type ProposalType } from "@/hooks/useProposals";

export { PROPOSAL_TYPE_LABEL };
export type ContractServiceType = ProposalType;

export type ContractStatus =
  | "draft"
  | "sent"
  | "signed_by_client"
  | "countersigned"
  | "active"
  | "expired"
  | "renewed"
  | "cancelled";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  signed_by_client: "Firmado por cliente",
  countersigned: "Contrafirmado",
  active: "Activo",
  expired: "Vencido",
  renewed: "Renovado",
  cancelled: "Cancelado",
};

export const CONTRACT_STATUS_CLASS: Record<ContractStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  signed_by_client: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  countersigned: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  renewed: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  cancelled: "bg-neutral-200 text-neutral-700 line-through",
};

export type ContractBlock = {
  type: "heading" | "paragraph" | "clause";
  title?: string;
  text: string;
};

export type ContractRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  proposal_id: string | null;
  template_id: string | null;
  title: string;
  service_type: ContractServiceType;
  status: ContractStatus;
  currency: string;
  total_amount: number;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  content: ContractBlock[];
  public_token: string;
  version: number;
  parent_contract_id: string | null;
  created_by: string | null;
  sent_at: string | null;
  client_signed_at: string | null;
  countersigned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractTemplateRow = {
  id: string;
  workspace_id: string;
  name: string;
  service_type: ContractServiceType;
  content: ContractBlock[];
  version: number;
  parent_template_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type ContractClauseRow = {
  id: string;
  workspace_id: string;
  title: string;
  body: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
};

export type ContractSignatureRow = {
  id: string;
  contract_id: string;
  signer_role: "client" | "agency";
  signer_name: string;
  signer_email: string | null;
  signature_data_url: string;
  consent_text: string | null;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
};

export type ContractEventRow = {
  id: string;
  contract_id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
};

// ------------- Variable substitution -------------

export type ContractVariables = {
  cliente?: string;
  workspace?: string;
  alcance?: string;
  precio?: string;
  moneda?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
};

export function applyContractVariables(
  blocks: ContractBlock[],
  vars: ContractVariables,
): ContractBlock[] {
  const map: Record<string, string> = {
    "{{cliente}}": vars.cliente ?? "",
    "{{workspace}}": vars.workspace ?? "",
    "{{alcance}}": vars.alcance ?? "",
    "{{precio}}": vars.precio ?? "",
    "{{moneda}}": vars.moneda ?? "",
    "{{fecha_inicio}}": vars.fecha_inicio ?? "",
    "{{fecha_fin}}": vars.fecha_fin ?? "",
  };
  const replace = (s: string) =>
    Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), s);
  return blocks.map((b) => ({
    ...b,
    title: b.title ? replace(b.title) : b.title,
    text: replace(b.text ?? ""),
  }));
}

export function formatVarDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return format(new Date(d), "d MMM yyyy");
  } catch {
    return d;
  }
}

export function formatVarPrice(amount: number | null | undefined): string {
  if (amount == null) return "";
  return Number(amount).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// ------------- Queries -------------

export type ContractsFilters = {
  clientId?: string | "all";
  serviceType?: ContractServiceType | "all";
  status?: ContractStatus | "all";
  search?: string;
};

export function useContracts(workspaceId: string | undefined, filters: ContractsFilters = {}) {
  return useQuery<ContractRow[]>({
    queryKey: ["contracts", workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("contracts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (filters.clientId && filters.clientId !== "all") q = q.eq("client_id", filters.clientId);
      if (filters.serviceType && filters.serviceType !== "all")
        q = q.eq("service_type", filters.serviceType);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      let rows = ((data ?? []) as any[]).map((r) => ({
        ...r,
        content: Array.isArray(r.content) ? r.content : [],
      })) as ContractRow[];
      if (filters.search?.trim()) {
        const s = filters.search.trim().toLowerCase();
        rows = rows.filter((r) => r.title.toLowerCase().includes(s));
      }
      return rows;
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery<ContractRow | null>({
    queryKey: ["contract", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        content: Array.isArray(data.content) ? data.content : [],
      } as ContractRow;
    },
  });
}

export function useContractTemplates(workspaceId: string | undefined) {
  return useQuery<ContractTemplateRow[]>({
    queryKey: ["contract_templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_templates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("service_type", { ascending: true })
        .order("version", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        content: Array.isArray(r.content) ? r.content : [],
      })) as ContractTemplateRow[];
    },
  });
}

export function useContractClauses(workspaceId: string | undefined) {
  return useQuery<ContractClauseRow[]>({
    queryKey: ["contract_clauses", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_clauses")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("category", { ascending: true, nullsFirst: false })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContractClauseRow[];
    },
  });
}

export function useContractSignatures(contractId: string | undefined) {
  return useQuery<ContractSignatureRow[]>({
    queryKey: ["contract_signatures", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_signatures")
        .select("*")
        .eq("contract_id", contractId)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContractSignatureRow[];
    },
  });
}

export function useContractEvents(contractId: string | undefined) {
  return useQuery<ContractEventRow[]>({
    queryKey: ["contract_events", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_events")
        .select("*")
        .eq("contract_id", contractId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractEventRow[];
    },
  });
}

// ------------- Mutations -------------

export type CreateContractInput = {
  clientId: string;
  projectId?: string | null;
  proposalId?: string | null;
  templateId?: string | null;
  title: string;
  serviceType: ContractServiceType;
  currency?: string;
  totalAmount?: number;
  startDate?: string | null;
  endDate?: string | null;
  autoRenew?: boolean;
  content?: ContractBlock[];
  variables?: ContractVariables;
};

export function useCreateContract(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContractInput) => {
      if (!workspaceId) throw new Error("No workspace activo");
      let content: ContractBlock[] = input.content ?? [];
      if (!input.content && input.templateId) {
        const { data: tpl, error: tErr } = await (supabase as any)
          .from("contract_templates")
          .select("content")
          .eq("id", input.templateId)
          .maybeSingle();
        if (tErr) throw tErr;
        content = (tpl?.content as ContractBlock[]) ?? [];
      }
      if (input.variables) content = applyContractVariables(content, input.variables);
      const { data, error } = await (supabase as any)
        .from("contracts")
        .insert({
          workspace_id: workspaceId,
          client_id: input.clientId,
          project_id: input.projectId ?? null,
          proposal_id: input.proposalId ?? null,
          template_id: input.templateId ?? null,
          title: input.title,
          service_type: input.serviceType,
          currency: input.currency ?? "usd",
          total_amount: input.totalAmount ?? 0,
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          auto_renew: input.autoRenew ?? false,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContractRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts", workspaceId] });
    },
  });
}

export type UpdateContractPatch = Partial<{
  title: string;
  content: ContractBlock[];
  currency: string;
  total_amount: number;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  project_id: string | null;
}>;

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: UpdateContractPatch }) => {
      const patch: any = { ...input.patch, updated_at: new Date().toISOString() };
      const { error } = await (supabase as any)
        .from("contracts")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["contract", vars.id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useSendContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("contracts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useCountersignContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contractId: string;
      signerName: string;
      signatureDataUrl: string;
    }) => {
      const { error } = await (supabase as any).rpc("countersign_contract", {
        p_contract_id: input.contractId,
        p_signer_name: input.signerName,
        p_signature_data_url: input.signatureDataUrl,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["contract", vars.contractId] });
      qc.invalidateQueries({ queryKey: ["contract_signatures", vars.contractId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useCancelContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("contracts")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useRenewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data: orig, error: rErr } = await (supabase as any)
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .single();
      if (rErr) throw rErr;
      const { data, error } = await (supabase as any)
        .from("contracts")
        .insert({
          workspace_id: orig.workspace_id,
          client_id: orig.client_id,
          project_id: orig.project_id,
          template_id: orig.template_id,
          title: orig.title,
          service_type: orig.service_type,
          currency: orig.currency,
          total_amount: orig.total_amount,
          content: orig.content,
          auto_renew: orig.auto_renew,
          parent_contract_id: orig.id,
          version: (orig.version ?? 1) + 1,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContractRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["contracts", row.workspace_id] });
    },
  });
}

export function useCreateContractFromProposal(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      if (!workspaceId) throw new Error("No workspace activo");
      const { data: prop, error: pErr } = await (supabase as any)
        .from("proposals")
        .select("id, workspace_id, lead_id, title, type, currency, total_amount")
        .eq("id", proposalId)
        .single();
      if (pErr) throw pErr;
      if (!prop.lead_id) throw new Error("La propuesta no está asociada a un lead");
      const { data: lead, error: lErr } = await (supabase as any)
        .from("leads")
        .select("id, company_name, converted_client_id")
        .eq("id", prop.lead_id)
        .single();
      if (lErr) throw lErr;
      if (!lead.converted_client_id)
        throw new Error("Convertí el lead a cliente antes de generar el contrato");

      const [{ data: client }, { data: ws }, { data: tpl }] = await Promise.all([
        (supabase as any).from("clients").select("name").eq("id", lead.converted_client_id).single(),
        (supabase as any).from("workspaces").select("name").eq("id", workspaceId).single(),
        (supabase as any)
          .from("contract_templates")
          .select("id, content")
          .eq("workspace_id", workspaceId)
          .eq("service_type", prop.type)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const vars: ContractVariables = {
        cliente: client?.name ?? "",
        workspace: ws?.name ?? "",
        precio: formatVarPrice(prop.total_amount),
        moneda: (prop.currency ?? "usd").toUpperCase(),
        fecha_inicio: "",
        fecha_fin: "",
        alcance: "",
      };
      const content: ContractBlock[] = tpl?.content
        ? applyContractVariables(tpl.content as ContractBlock[], vars)
        : [];

      const { data, error } = await (supabase as any)
        .from("contracts")
        .insert({
          workspace_id: workspaceId,
          client_id: lead.converted_client_id,
          proposal_id: prop.id,
          template_id: tpl?.id ?? null,
          title: prop.title,
          service_type: prop.type,
          currency: prop.currency ?? "usd",
          total_amount: prop.total_amount ?? 0,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContractRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts", workspaceId] });
    },
  });
}

// ------------- Template & Clause CRUD (owner-only via RLS) -------------

export function useUpsertContractTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      service_type: ContractServiceType;
      content: ContractBlock[];
      is_active: boolean;
    }) => {
      if (!workspaceId) throw new Error("No workspace activo");
      if (input.id) {
        const { error } = await (supabase as any)
          .from("contract_templates")
          .update({
            name: input.name,
            service_type: input.service_type,
            content: input.content,
            is_active: input.is_active,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("contract_templates").insert({
          workspace_id: workspaceId,
          name: input.name,
          service_type: input.service_type,
          content: input.content,
          is_active: input.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_templates", workspaceId] });
    },
  });
}

export function useSetActiveTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; service_type: ContractServiceType }) => {
      if (!workspaceId) throw new Error("No workspace activo");
      // deactivate other templates of same type
      await (supabase as any)
        .from("contract_templates")
        .update({ is_active: false })
        .eq("workspace_id", workspaceId)
        .eq("service_type", input.service_type)
        .neq("id", input.id);
      const { error } = await (supabase as any)
        .from("contract_templates")
        .update({ is_active: true })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_templates", workspaceId] });
    },
  });
}

export function useDeleteContractTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_templates", workspaceId] });
    },
  });
}

export function useUpsertContractClause(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      body: string;
      category?: string | null;
      is_active?: boolean;
    }) => {
      if (!workspaceId) throw new Error("No workspace activo");
      if (input.id) {
        const { error } = await (supabase as any)
          .from("contract_clauses")
          .update({
            title: input.title,
            body: input.body,
            category: input.category ?? null,
            is_active: input.is_active ?? true,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("contract_clauses").insert({
          workspace_id: workspaceId,
          title: input.title,
          body: input.body,
          category: input.category ?? null,
          is_active: input.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_clauses", workspaceId] });
    },
  });
}

export function useDeleteContractClause(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("contract_clauses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract_clauses", workspaceId] });
    },
  });
}

// ------------- Public (no auth) -------------

export function useFetchPublicContract(token: string | undefined) {
  return useQuery({
    queryKey: ["public_contract", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-contract", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as {
        contract: ContractRow;
        client: { name: string } | null;
        signatures: ContractSignatureRow[];
      };
      return {
        ...d,
        contract: {
          ...d.contract,
          content: Array.isArray(d.contract.content) ? d.contract.content : [],
        },
      };
    },
  });
}

export function useSignContractPublic() {
  return useMutation({
    mutationFn: async (input: {
      token: string;
      signer_name: string;
      signer_email?: string | null;
      signature_data_url: string;
      consent: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("sign-contract", {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { success: true };
    },
  });
}
