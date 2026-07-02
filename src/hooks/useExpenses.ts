import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExpenseCategory = "ads_spend" | "software" | "contractor" | "other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "ads_spend",
  "software",
  "contractor",
  "other",
];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  ads_spend: "Ads / Publicidad",
  software: "Software",
  contractor: "Contratistas",
  other: "Otro",
};

export type ExpenseRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  client_id: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  vendor: string | null;
  is_billable: boolean;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
  client?: { id: string; name: string; slug: string } | null;
  project?: { id: string; name: string; type: string } | null;
};

export type ExpenseFilters = {
  categories?: ExpenseCategory[];
  projectId?: string;
  clientId?: string;
  from?: string | null;
  to?: string | null;
};

const EXPENSE_SELECT =
  "id, workspace_id, project_id, client_id, category, description, amount, currency, expense_date, vendor, is_billable, receipt_url, created_by, created_at, client:clients(id, name, slug), project:projects(id, name, type)";

export function useExpenses(workspaceId: string | undefined, filters: ExpenseFilters = {}) {
  return useQuery<ExpenseRow[]>({
    queryKey: ["expenses", workspaceId, filters],
    enabled: !!workspaceId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = (supabase as any)
        .from("expenses")
        .select(EXPENSE_SELECT)
        .eq("workspace_id", workspaceId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (filters.categories?.length) q = q.in("category", filters.categories);
      if (filters.projectId) q = q.eq("project_id", filters.projectId);
      if (filters.clientId) q = q.eq("client_id", filters.clientId);
      if (filters.from) q = q.gte("expense_date", filters.from);
      if (filters.to) q = q.lte("expense_date", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });
}

export type NewExpenseInput = {
  workspaceId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  vendor?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  isBillable: boolean;
  currency?: string;
  receiptUrl?: string | null;
};

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewExpenseInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("expenses")
        .insert({
          workspace_id: input.workspaceId,
          category: input.category,
          description: input.description,
          amount: input.amount,
          currency: input.currency ?? "usd",
          expense_date: input.expenseDate,
          vendor: input.vendor ?? null,
          project_id: input.projectId ?? null,
          client_id: input.clientId ?? null,
          is_billable: input.isBillable,
          receipt_url: input.receiptUrl ?? null,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}
