import { useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/clients/kpi-card";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useExpenses, type ExpenseCategory } from "@/hooks/useExpenses";
import { ExpensesFiltersBar } from "./expenses-filters-bar";
import { ExpensesTable } from "./expenses-table";
import { NewExpenseDialog } from "./new-expense-dialog";
import { formatMoney } from "@/lib/money";

export function GastosTab() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const { data: projects = [] } = useProjects(workspaceId, {});

  const clientOptions = useMemo(
    () => clients.map((c) => ({ id: c.id, name: c.name })),
    [clients],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name, client_id: p.client_id })),
    [projects],
  );

  const { data: expenses = [], isLoading } = useExpenses(workspaceId, {
    categories: category === "all" ? undefined : [category],
    clientId: clientId || undefined,
    projectId: projectId || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const { data: allExpenses = [] } = useExpenses(workspaceId, {});
  const kpis = useMemo(() => {
    const now = new Date();
    const s = format(startOfMonth(now), "yyyy-MM-dd");
    const e = format(endOfMonth(now), "yyyy-MM-dd");
    const monthExp = allExpenses.filter((x) => x.expense_date >= s && x.expense_date <= e);
    const total = monthExp.reduce((sum, x) => sum + Number(x.amount), 0);
    const billable = monthExp
      .filter((x) => x.is_billable)
      .reduce((sum, x) => sum + Number(x.amount), 0);
    const pct = total > 0 ? (billable / total) * 100 : 0;
    return { total, billablePct: pct };
  }, [allExpenses]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total gastos este mes" value={formatMoney(kpis.total)} />
        <KpiCard label="% facturable" value={`${kpis.billablePct.toFixed(0)}%`} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ExpensesFiltersBar
          clients={clientOptions}
          projects={projectOptions}
          category={category}
          clientId={clientId}
          projectId={projectId}
          from={from}
          to={to}
          onChange={(p) => {
            if (p.category !== undefined) setCategory(p.category);
            if (p.clientId !== undefined) setClientId(p.clientId);
            if (p.projectId !== undefined) setProjectId(p.projectId);
            if (p.from !== undefined) setFrom(p.from);
            if (p.to !== undefined) setTo(p.to);
          }}
          onClear={() => {
            setCategory("all");
            setClientId("");
            setProjectId("");
            setFrom("");
            setTo("");
          }}
        />
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Nuevo gasto
        </Button>
      </div>

      <ExpensesTable expenses={expenses} loading={isLoading} />

      <NewExpenseDialog
        open={openNew}
        onOpenChange={setOpenNew}
        workspaceId={workspaceId}
      />
    </div>
  );
}
