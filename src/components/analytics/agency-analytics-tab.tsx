import { useMemo } from "react";
import { Link } from "react-router-dom";
import { subMonths, format, startOfMonth, endOfMonth, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/clients/kpi-card";
import { TabComingSoon } from "@/components/clients/tab-coming-soon";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useInvoices } from "@/hooks/useInvoices";
import { useExpenses } from "@/hooks/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers, useTimeEntries } from "@/hooks/useTeam";
import { formatMoney } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import {
  PROJECT_TYPE_LABEL,
  PROJECT_TYPES,
} from "@/components/projects/project-meta";
import type { ProjectType } from "@/integrations/supabase/database.types";

const REVENUE_COLOR = "#5140f2";
const ACCENT_COLOR = "#ff7503";

// ─────────────────────────────── invoice_items (workspace-wide) ───────────────────────────────
function useInvoiceItemsAgency(workspaceId: string | undefined) {
  return useQuery<
    {
      id: string;
      project_id: string | null;
      amount: number;
      invoice: {
        id: string;
        status: string;
        workspace_id: string;
        client_id: string;
      } | null;
    }[]
  >({
    queryKey: ["agency-analytics-invoice-items", workspaceId],
    enabled: !!workspaceId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_items")
        .select(
          "id, project_id, amount, invoice:invoices!inner(id, status, workspace_id, client_id)",
        )
        .eq("invoice.workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// Approval timing pulled directly from social_posts (last_approval_sent_at not in the
// shared hook payload).
function useApprovalTimings(workspaceId: string | undefined) {
  return useQuery<
    { client_id: string; sent_at: string; approved_at: string }[]
  >({
    queryKey: ["agency-analytics-approval-timings", workspaceId],
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_posts")
        .select("client_id, last_approval_sent_at, approved_at, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "approved")
        .not("last_approval_sent_at", "is", null)
        .not("approved_at", "is", null);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        client_id: r.client_id,
        sent_at: r.last_approval_sent_at,
        approved_at: r.approved_at,
      }));
    },
  });
}

// ─────────────────────────────── Utilization helpers ───────────────────────────────
function utilizationTone(pct: number): { color: string; label: string } {
  if (pct >= 70) return { color: "bg-emerald-500", label: "Óptimo" };
  if (pct >= 40) return { color: "bg-amber-500", label: "Medio" };
  return { color: "bg-destructive", label: "Bajo" };
}

export function AgencyAnalyticsTab() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const cutoff12mo = format(subMonths(new Date(), 12), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: invoices = [], isLoading: iL } = useInvoices(workspaceId, {});
  const { data: expenses = [], isLoading: eL } = useExpenses(workspaceId, {});
  const { data: projects = [], isLoading: prL } = useProjects(workspaceId, {});
  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const { data: members = [], isLoading: mL } = useTeamMembers(workspaceId);
  const { data: monthEntries = [], isLoading: tL } = useTimeEntries(workspaceId, {
    from: monthStart,
    to: monthEnd,
  });
  const { data: allEntries = [] } = useTimeEntries(workspaceId);
  const { data: items = [], isLoading: itL } = useInvoiceItemsAgency(workspaceId);
  const { data: approvals = [], isLoading: aL } = useApprovalTimings(workspaceId);

  // ── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const revenue12mo = invoices
      .filter((i) => i.status === "paid" && i.paid_at && i.paid_at.slice(0, 10) >= cutoff12mo)
      .reduce((s, i) => s + Number(i.total), 0);

    const activeProjects = projects.filter(
      (p) => p.status === "planning" || p.status === "in_progress",
    ).length;

    const activeClients = clients.filter((c) => c.status === "active").length;

    const paidInvoiceIds = new Set(
      invoices.filter((i) => i.status === "paid").map((i) => i.id),
    );
    const paidItemsRevenue = items
      .filter((it) => it.invoice && paidInvoiceIds.has(it.invoice.id))
      .reduce((s, it) => s + Number(it.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const marginPct =
      paidItemsRevenue > 0
        ? ((paidItemsRevenue - totalExpenses) / paidItemsRevenue) * 100
        : null;

    return { revenue12mo, activeProjects, activeClients, marginPct };
  }, [invoices, projects, clients, items, expenses, cutoff12mo]);

  // ── Utilization ──────────────────────────────────────────────
  const utilization = useMemo(() => {
    return members.map((m) => {
      const capacity = Number(m.weekly_capacity_hours ?? 0) * 4.33;
      const hours = monthEntries
        .filter((e) => e.user_id === m.user_id)
        .reduce((s, e) => s + Number(e.hours), 0);
      const pct = capacity > 0 ? (hours / capacity) * 100 : null;
      return {
        user_id: m.user_id,
        name: m.full_name ?? m.email ?? m.user_id.slice(0, 8),
        title: m.title,
        capacity,
        hours,
        pct,
      };
    });
  }, [members, monthEntries]);

  const hasAnyTimeEntry = allEntries.length > 0;

  // ── Service profitability (per project.type) ─────────────────
  const services = useMemo(() => {
    const projectType = new Map<string, ProjectType>();
    projects.forEach((p) => projectType.set(p.id, p.type as ProjectType));

    const rows = new Map<ProjectType, { revenue: number; costo: number }>();
    PROJECT_TYPES.forEach((t) => rows.set(t, { revenue: 0, costo: 0 }));

    items.forEach((it) => {
      if (!it.project_id) return;
      if (!it.invoice || it.invoice.status !== "paid") return;
      const t = projectType.get(it.project_id);
      if (!t) return;
      rows.get(t)!.revenue += Number(it.amount);
    });
    expenses.forEach((e) => {
      if (!e.project_id) return;
      const t = projectType.get(e.project_id);
      if (!t) return;
      rows.get(t)!.costo += Number(e.amount);
    });

    return PROJECT_TYPES.map((t) => {
      const r = rows.get(t)!;
      const margen = r.revenue - r.costo;
      const pct = r.revenue > 0 ? (margen / r.revenue) * 100 : 0;
      return { type: t, revenue: r.revenue, costo: r.costo, margen, pct };
    }).sort((a, b) => b.margen - a.margen);
  }, [projects, items, expenses]);

  // ── Client profitability ─────────────────────────────────────
  const clientProfit = useMemo(() => {
    const rateByUser = new Map<string, number>();
    members.forEach((m) => rateByUser.set(m.user_id, Number(m.hourly_rate ?? 0)));

    const rows = new Map<
      string,
      { name: string; revenue: number; costo: number }
    >();
    clients.forEach((c) => rows.set(c.id, { name: c.name, revenue: 0, costo: 0 }));

    invoices.forEach((i) => {
      if (i.status !== "paid") return;
      const row = rows.get(i.client_id);
      if (!row) return;
      row.revenue += Number(i.total);
    });

    expenses.forEach((e) => {
      if (!e.client_id) return;
      const row = rows.get(e.client_id);
      if (!row) return;
      row.costo += Number(e.amount);
    });

    allEntries.forEach((t) => {
      if (!t.client_id) return;
      const row = rows.get(t.client_id);
      if (!row) return;
      const rate = rateByUser.get(t.user_id) ?? 0;
      row.costo += Number(t.hours) * rate;
    });

    return Array.from(rows.entries())
      .map(([id, r]) => {
        const margen = r.revenue - r.costo;
        const pct = r.revenue > 0 ? (margen / r.revenue) * 100 : null;
        return { id, name: r.name, revenue: r.revenue, costo: r.costo, margen, pct };
      })
      .filter((r) => r.revenue > 0 || r.costo > 0)
      .sort((a, b) => b.margen - a.margen);
  }, [clients, invoices, expenses, allEntries, members]);

  const topClient = clientProfit[0] ?? null;
  const bottomClient =
    clientProfit.length > 1 ? clientProfit[clientProfit.length - 1] : null;

  // ── Approval timings by client ───────────────────────────────
  const approvalByClient = useMemo(() => {
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const acc = new Map<string, { total: number; count: number }>();
    approvals.forEach((r) => {
      const h = differenceInHours(new Date(r.approved_at), new Date(r.sent_at));
      if (h < 0) return;
      const cur = acc.get(r.client_id) ?? { total: 0, count: 0 };
      cur.total += h;
      cur.count += 1;
      acc.set(r.client_id, cur);
    });
    return Array.from(acc.entries())
      .map(([client_id, v]) => ({
        client_id,
        name: clientName.get(client_id) ?? client_id.slice(0, 8),
        avgHours: v.total / v.count,
        count: v.count,
      }))
      .sort((a, b) => a.avgHours - b.avgHours);
  }, [approvals, clients]);

  const loading = iL || eL || prL || itL;

  return (
    <div className="space-y-6">
      {/* 1 — Global KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Revenue (12m)"
          value={loading ? "—" : formatMoney(kpis.revenue12mo)}
          hint="Facturas pagadas, últimos 12 meses"
        />
        <KpiCard
          label="Proyectos activos"
          value={loading ? "—" : kpis.activeProjects}
          hint="Planning + en ejecución"
        />
        <KpiCard
          label="Clientes activos"
          value={loading ? "—" : kpis.activeClients}
        />
        <KpiCard
          label="Margen global"
          value={
            loading || kpis.marginPct === null
              ? "—"
              : `${kpis.marginPct.toFixed(1)}%`
          }
          hint="(Revenue − Gastos) / Revenue"
        />
      </div>

      {/* 2 — Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Capacidad del equipo
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (utilización de este mes vs. capacidad estimada)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mL || tL ? (
            <Skeleton className="h-40 w-full" />
          ) : !hasAnyTimeEntry ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no hay horas registradas.
              </p>
              <Link
                to="/app/equipo"
                className="text-sm font-medium text-primary hover:underline"
              >
                Ir a Equipo →
              </Link>
            </div>
          ) : utilization.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay miembros activos.
            </p>
          ) : (
            <div className="space-y-3">
              {utilization.map((u) => {
                if (u.pct === null) {
                  return (
                    <div key={u.user_id} className="flex items-center gap-4">
                      <div className="w-48 truncate">
                        <div className="text-sm font-medium">{u.name}</div>
                        {u.title && (
                          <div className="text-xs text-muted-foreground">
                            {u.title}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground">
                        Sin capacidad definida
                      </div>
                      <div className="w-32 text-right text-sm text-muted-foreground">
                        {u.hours.toFixed(1)}h este mes
                      </div>
                    </div>
                  );
                }
                const pct = Math.min(u.pct, 200);
                const tone = utilizationTone(u.pct);
                return (
                  <div key={u.user_id} className="flex items-center gap-4">
                    <div className="w-48 truncate">
                      <div className="text-sm font-medium">{u.name}</div>
                      {u.title && (
                        <div className="text-xs text-muted-foreground">
                          {u.title}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${tone.color} transition-all`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-40 text-right text-sm">
                      <span className="font-medium">{u.pct.toFixed(0)}%</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {u.hours.toFixed(1)} / {u.capacity.toFixed(0)}h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3 — Service profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Margen por servicio</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
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
                        (s.margen >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive")
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
          )}
        </CardContent>
      </Card>

      {/* 4 — Client profitability */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Cliente más rentable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClient ? (
                <>
                  <div className="font-display text-xl font-bold">{topClient.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Margen {formatMoney(topClient.margen)}
                    {topClient.pct !== null && (
                      <span className="ml-2">({topClient.pct.toFixed(0)}%)</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-destructive">
                Cliente menos rentable
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bottomClient ? (
                <>
                  <div className="font-display text-xl font-bold">
                    {bottomClient.name}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Margen {formatMoney(bottomClient.margen)}
                    {bottomClient.pct !== null && (
                      <span className="ml-2">({bottomClient.pct.toFixed(0)}%)</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos suficientes</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de rentabilidad por cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {clientProfit.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay revenue ni gastos registrados por cliente.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientProfit.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.revenue)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.costo)}</TableCell>
                      <TableCell
                        className={
                          "text-right font-medium " +
                          (c.margen >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive")
                        }
                      >
                        {formatMoney(c.margen)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {c.pct !== null ? `${c.pct.toFixed(0)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5 — Approval timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tiempo de aprobación de contenido
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (promedio horas entre envío y aprobación · objetivo 48h)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aL ? (
            <Skeleton className="h-64 w-full" />
          ) : approvalByClient.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay posts aprobados con timestamps de envío y aprobación.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={approvalByClient}
                  layout="vertical"
                  margin={{ left: 16, right: 24, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs"
                    width={140}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}h`, "Promedio"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    x={48}
                    stroke={ACCENT_COLOR}
                    strokeDasharray="4 4"
                    label={{
                      value: "48h",
                      fill: ACCENT_COLOR,
                      fontSize: 11,
                      position: "top",
                    }}
                  />
                  <Bar dataKey="avgHours" fill={REVENUE_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6 — NPS placeholder */}
      <TabComingSoon
        title="NPS / satisfacción del cliente"
        description="Se activará cuando exista un flujo de encuestas de satisfacción. Aún no hay una fuente de datos configurada."
      />
    </div>
  );
}
