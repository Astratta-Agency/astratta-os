import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useInvoices, usePayments } from "@/hooks/useInvoices";
import { useExpenses } from "@/hooks/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@/lib/money";
import {
  PROJECT_TYPE_LABEL,
  PROJECT_TYPES,
} from "@/components/projects/project-meta";
import type { ProjectType } from "@/integrations/supabase/database.types";

const REVENUE_COLOR = "#5140f2";
const EXPENSE_COLOR = "#ff7503";
const IN_COLOR = "#5140f2";
const OUT_COLOR = "#ff7503";

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function last6Months(): { key: string; label: string }[] {
  const now = new Date();
  const arr: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    arr.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM yy", { locale: es }),
    });
  }
  return arr;
}

export function FinanceReportsTab() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const { data: invoices = [], isLoading: iL } = useInvoices(workspaceId, {});
  const { data: payments = [], isLoading: pL } = usePayments(workspaceId, {});
  const { data: expenses = [], isLoading: eL } = useExpenses(workspaceId, {});
  const { data: projects = [] } = useProjects(workspaceId, {});
  const { data: itemsForServices = [] } = useInvoiceItemsForServices(workspaceId);

  const months = useMemo(() => last6Months(), []);
  const monthSet = new Set(months.map((m) => m.key));

  // ── P&L monthly ──────────────────────────────────────────────
  const pnl = useMemo(() => {
    const rev: Record<string, number> = {};
    const exp: Record<string, number> = {};
    months.forEach((m) => {
      rev[m.key] = 0;
      exp[m.key] = 0;
    });
    invoices.forEach((i) => {
      if (i.status !== "paid" || !i.paid_at) return;
      const k = monthKey(i.paid_at);
      if (monthSet.has(k)) rev[k] += Number(i.total);
    });
    expenses.forEach((e) => {
      const k = monthKey(e.expense_date);
      if (monthSet.has(k)) exp[k] += Number(e.amount);
    });
    return months.map((m) => {
      const revenue = rev[m.key];
      const gastos = exp[m.key];
      const margen = revenue - gastos;
      const margenPct = revenue > 0 ? (margen / revenue) * 100 : 0;
      return { ...m, revenue, gastos, margen, margenPct };
    });
  }, [invoices, expenses, months, monthSet]);

  // ── Cash flow ────────────────────────────────────────────────
  const cashflow = useMemo(() => {
    const inn: Record<string, number> = {};
    const out: Record<string, number> = {};
    months.forEach((m) => {
      inn[m.key] = 0;
      out[m.key] = 0;
    });
    payments.forEach((p) => {
      if (p.status !== "succeeded") return;
      const k = monthKey(p.paid_at);
      if (monthSet.has(k)) inn[k] += Number(p.amount);
    });
    expenses.forEach((e) => {
      const k = monthKey(e.expense_date);
      if (monthSet.has(k)) out[k] += Number(e.amount);
    });
    return months.map((m) => ({
      label: m.label,
      entradas: inn[m.key],
      salidas: out[m.key],
    }));
  }, [payments, expenses, months, monthSet]);

  // ── Top clients (last 12 months, paid invoices) ──────────────
  const topClients = useMemo(() => {
    const cutoff = format(subMonths(new Date(), 12), "yyyy-MM-dd");
    const totals = new Map<string, { name: string; total: number }>();
    invoices.forEach((i) => {
      if (i.status !== "paid" || !i.client) return;
      if (i.issue_date < cutoff) return;
      const cur = totals.get(i.client_id) ?? { name: i.client.name, total: 0 };
      cur.total += Number(i.total);
      totals.set(i.client_id, cur);
    });
    return Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [invoices]);

  // ── Services profitability by project type ───────────────────
  const services = useMemo(() => {
    const projectType = new Map<string, ProjectType>();
    projects.forEach((p) => projectType.set(p.id, p.type));

    const rows = new Map<ProjectType, { revenue: number; costo: number }>();
    PROJECT_TYPES.forEach((t) => rows.set(t, { revenue: 0, costo: 0 }));

    itemsForServices.forEach((it) => {
      if (!it.project_id) return;
      if (!it.invoice || it.invoice.status !== "paid") return;
      const t = projectType.get(it.project_id);
      if (!t) return;
      const row = rows.get(t)!;
      row.revenue += Number(it.amount);
    });

    expenses.forEach((e) => {
      if (!e.project_id) return;
      const t = projectType.get(e.project_id);
      if (!t) return;
      const row = rows.get(t)!;
      row.costo += Number(e.amount);
    });

    return PROJECT_TYPES.map((t) => {
      const r = rows.get(t)!;
      const margen = r.revenue - r.costo;
      const pct = r.revenue > 0 ? (margen / r.revenue) * 100 : 0;
      return { type: t, revenue: r.revenue, costo: r.costo, margen, pct };
    });
  }, [projects, itemsForServices, expenses]);

  const loading = iL || pL || eL;

  return (
    <div className="space-y-6">
      {/* P&L */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">P&amp;L mensual — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={pnl}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatMoney(v)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" name="Gastos" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pnl.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="capitalize">{r.label}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.gastos)}</TableCell>
                    <TableCell
                      className={
                        "text-right font-medium " +
                        (r.margen >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                      }
                    >
                      {formatMoney(r.margen)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.revenue > 0 ? `${r.margenPct.toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cash flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash flow — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatMoney(v)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="entradas"
                    name="Entradas"
                    stroke={IN_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="salidas"
                    name="Salidas"
                    stroke={OUT_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top clientes por revenue
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (últimos 12 meses, facturas pagadas)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay facturas pagadas en los últimos 12 meses.
              </p>
            ) : (
              <div className="space-y-2">
                {topClients.map((c, i) => {
                  const max = topClients[0].total || 1;
                  return (
                    <div key={c.name + i} className="flex items-center gap-3">
                      <div className="w-40 truncate text-sm">{c.name}</div>
                      <div className="flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(c.total / max) * 100}%`,
                            backgroundColor: REVENUE_COLOR,
                          }}
                        />
                      </div>
                      <div className="w-24 text-right text-sm font-medium">
                        {formatMoney(c.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Servicios más rentables */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Servicios más rentables</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.type}>
                    <TableCell>{PROJECT_TYPE_LABEL[s.type]}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.revenue)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.costo)}</TableCell>
                    <TableCell
                      className={
                        "text-right font-medium " +
                        (s.margen >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                      }
                    >
                      {formatMoney(s.margen)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {s.revenue > 0 ? `${s.pct.toFixed(0)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Workspace-wide invoice_items join used only by the services report.
// Kept local since the main useInvoices hook doesn't fetch items across invoices.
function useInvoiceItemsForServices(workspaceId: string | undefined) {
  return useQuery<
    {
      id: string;
      invoice_id: string;
      project_id: string | null;
      amount: number;
      invoice: { id: string; status: string; workspace_id: string } | null;
    }[]
  >({
    queryKey: ["invoice-items-for-services", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_items")
        .select(
          "id, invoice_id, project_id, amount, invoice:invoices!inner(id, status, workspace_id)",
        )
        .eq("invoice.workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
