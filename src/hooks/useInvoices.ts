import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "void";
export type PaymentMethod = "stripe" | "ach" | "check" | "cash" | "wire" | "other";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type InvoiceRow = {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  is_recurring: boolean;
  recurrence_interval: "monthly" | "quarterly" | "yearly" | null;
  notes: string | null;
  terms: string | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_hosted_invoice_url: string | null;
  stripe_invoice_pdf: string | null;
  sent_at: string | null;
  paid_at: string | null;
  void_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    brand_primary_color: string | null;
  } | null;
  project?: { id: string; name: string } | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  project_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
};

export type PaymentRow = {
  id: string;
  workspace_id: string;
  invoice_id: string | null;
  client_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  receipt_url: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  client?: { id: string; name: string; slug: string } | null;
  invoice?: { id: string; invoice_number: string | null } | null;
};

export type InvoiceFilters = {
  clientIds?: string[];
  statuses?: InvoiceStatus[];
  from?: string | null;
  to?: string | null;
  clientId?: string;
};

const INVOICE_SELECT =
  "id, workspace_id, client_id, project_id, invoice_number, status, issue_date, due_date, currency, subtotal, tax_rate, tax_amount, total, amount_paid, is_recurring, recurrence_interval, notes, terms, stripe_customer_id, stripe_invoice_id, stripe_hosted_invoice_url, stripe_invoice_pdf, sent_at, paid_at, void_at, created_by, created_at, updated_at, client:clients!inner(id, name, slug, logo_url, brand_primary_color), project:projects(id, name)";

export function useInvoices(workspaceId: string | undefined, filters: InvoiceFilters = {}) {
  return useQuery<InvoiceRow[]>({
    queryKey: ["invoices", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = (supabase as any)
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("workspace_id", workspaceId)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.clientIds?.length) q = q.in("client_id", filters.clientIds);
      if (filters.statuses?.length) q = q.in("status", filters.statuses);
      if (filters.from) q = q.gte("issue_date", filters.from);
      if (filters.to) q = q.lte("issue_date", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery<InvoiceRow | null>({
    queryKey: ["invoice", invoiceId],
    enabled: !!invoiceId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data as InvoiceRow | null;
    },
  });
}

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery<InvoiceItem[]>({
    queryKey: ["invoice-items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_items")
        .select("id, invoice_id, project_id, description, quantity, unit_price, amount, sort_order")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvoiceItem[];
    },
  });
}

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery<PaymentRow[]>({
    queryKey: ["invoice-payments", invoiceId],
    enabled: !!invoiceId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payments")
        .select("id, workspace_id, invoice_id, client_id, amount, currency, method, status, stripe_payment_intent_id, stripe_charge_id, receipt_url, paid_at, notes, created_at")
        .eq("invoice_id", invoiceId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
}

export function usePayments(
  workspaceId: string | undefined,
  filters: { clientIds?: string[]; methods?: PaymentMethod[]; clientId?: string } = {},
) {
  return useQuery<PaymentRow[]>({
    queryKey: ["payments", workspaceId, filters],
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = (supabase as any)
        .from("payments")
        .select(
          "id, workspace_id, invoice_id, client_id, amount, currency, method, status, stripe_payment_intent_id, stripe_charge_id, receipt_url, paid_at, notes, created_at, client:clients(id, name, slug), invoice:invoices(id, invoice_number)",
        )
        .eq("workspace_id", workspaceId)
        .order("paid_at", { ascending: false });
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.clientIds?.length) q = q.in("client_id", filters.clientIds);
      if (filters.methods?.length) q = q.in("method", filters.methods);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });
}

export type NewInvoiceInput = {
  workspaceId: string;
  clientId: string;
  projectId?: string | null;
  issueDate: string;
  dueDate: string;
  taxRate: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
};

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewInvoiceInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: inv, error } = await (supabase as any)
        .from("invoices")
        .insert({
          workspace_id: input.workspaceId,
          client_id: input.clientId,
          project_id: input.projectId ?? null,
          issue_date: input.issueDate,
          due_date: input.dueDate,
          currency: input.currency ?? "usd",
          tax_rate: input.taxRate,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          status: "draft",
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const invoiceId = inv.id as string;

      if (input.items.length) {
        const rows = input.items.map((it, i) => ({
          invoice_id: invoiceId,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          sort_order: i,
        }));
        const { error: itemsErr } = await (supabase as any).from("invoice_items").insert(rows);
        if (itemsErr) throw itemsErr;
      }
      return invoiceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoiceItems(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id?: string; description: string; quantity: number; unit_price: number }[]) => {
      // simple replace strategy: delete existing + insert new
      const { error: delErr } = await (supabase as any).from("invoice_items").delete().eq("invoice_id", invoiceId);
      if (delErr) throw delErr;
      if (items.length) {
        const rows = items.map((it, i) => ({
          invoice_id: invoiceId,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          sort_order: i,
        }));
        const { error } = await (supabase as any).from("invoice_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-items", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoice(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<InvoiceRow, "issue_date" | "due_date" | "tax_rate" | "notes" | "terms" | "project_id">>) => {
      const { error } = await (supabase as any).from("invoices").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await (supabase as any).from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useMarkInvoiceSent(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useVoidInvoice(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("invoices")
        .update({ status: "void", void_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useSendInvoiceViaStripe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke("create-stripe-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        const d = data as any;
        const err = new Error(d?.error ?? "stripe_error") as Error & { code?: string; detail?: string };
        err.code = d?.error;
        err.detail = d?.detail;
        throw err;
      }
      return data as { success: true; hosted_invoice_url: string; invoice_pdf: string };
    },
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export type NewPaymentInput = {
  workspaceId: string;
  clientId: string;
  invoiceId: string;
  amount: number;
  method: Exclude<PaymentMethod, "stripe">;
  paidAt: string;
  notes?: string | null;
};

export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPaymentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("payments").insert({
        workspace_id: input.workspaceId,
        client_id: input.clientId,
        invoice_id: input.invoiceId,
        amount: input.amount,
        currency: "usd",
        method: input.method,
        status: "succeeded",
        paid_at: input.paidAt,
        notes: input.notes ?? null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["invoice", input.invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoice-payments", input.invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export type WorkspaceFinanceDefaults = {
  default_tax_rate: number;
  default_payment_terms_days: number;
  invoice_notes_default: string | null;
};

export function useWorkspaceFinanceDefaults(workspaceId: string | undefined) {
  return useQuery<WorkspaceFinanceDefaults>({
    queryKey: ["workspace-finance-defaults", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspaces")
        .select("default_tax_rate, default_payment_terms_days, invoice_notes_default")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return {
        default_tax_rate: Number(data?.default_tax_rate ?? 0),
        default_payment_terms_days: Number(data?.default_payment_terms_days ?? 15),
        invoice_notes_default: data?.invoice_notes_default ?? null,
      };
    },
  });
}
