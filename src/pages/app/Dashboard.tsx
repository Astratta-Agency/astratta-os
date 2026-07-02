import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  FileWarning,
  FolderKanban,
  ListTodo,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/clients/kpi-card";
import { ChannelIcon } from "@/components/calendar/channel-icon";

import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useInvoices } from "@/hooks/useInvoices";
import { useProjectsStats } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useSales";
import { useContracts } from "@/hooks/useContracts";
import { useClients } from "@/hooks/useClients";
import { useDashboardKpis } from "@/hooks/useDashboardKpis";

import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { NewProjectGlobalDialog } from "@/components/projects/new-project-global-dialog";
import { NewInvoiceDialog } from "@/components/finanzas/new-invoice-dialog";

import { formatMoney } from "@/lib/money";
import { PRIORITY_CLASS, PRIORITY_LABEL } from "@/lib/task-labels";
import type { Channel } from "@/lib/post-states";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function firstName(user: { email?: string | null; user_metadata?: any } | null): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as any;
  const name: string | undefined = meta.full_name ?? meta.name ?? undefined;
  if (name) return name.split(" ")[0];
  if (user.email) return user.email.split("@")[0];
  return null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { data: userCtx } = useUserContext();

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);

  // Data
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices(workspaceId);
  const { data: projectsStats, isLoading: statsLoading } = useProjectsStats(workspaceId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(workspaceId);
  const { data: leads = [], isLoading: leadsLoading } = useLeads(workspaceId);
  const { data: contracts = [], isLoading: contractsLoading } = useContracts(workspaceId);
  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const { data: dash, isLoading: dashLoading } = useDashboardKpis(workspaceId);

  const clientOptions = useMemo(
    () => clients.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    [clients],
  );

  // KPIs derived
  const revenueThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return invoices.reduce((sum, inv) => {
      if (inv.status !== "paid" || !inv.paid_at) return sum;
      const d = new Date(inv.paid_at);
      if (d >= monthStart && d < monthEnd) return sum + Number(inv.total || 0);
      return sum;
    }, 0);
  }, [invoices]);

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(
      (t) => t.status !== "done" && t.due_date && new Date(t.due_date) < today,
    );
  }, [tasks]);

  const criticalTasksToday = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === "done") return false;
        if (!t.due_date) return false;
        const d = parseISO(t.due_date);
        const isCritical = t.priority === "p0" || t.priority === "p1";
        return isCritical && (isToday(d) || isPast(d));
      })
      .sort((a, b) => {
        const pa = a.priority === "p0" ? 0 : 1;
        const pb = b.priority === "p0" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.due_date ?? "").localeCompare(b.due_date ?? "");
      })
      .slice(0, 6);
  }, [tasks]);

  const leadsInPipeline = useMemo(
    () => leads.filter((l) => l.stage !== "ganado" && l.stage !== "perdido").length,
    [leads],
  );

  const contractsExpiring = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    return contracts.filter(
      (c) => c.status === "active" && c.end_date && new Date(c.end_date) <= in30 && new Date(c.end_date) >= now,
    );
  }, [contracts]);

  const invoicesOverdue = useMemo(
    () => invoices.filter((inv) => inv.status === "overdue"),
    [invoices],
  );

  const overdueTotal = useMemo(
    () => invoicesOverdue.reduce((s, inv) => s + Number(inv.total || 0) - Number(inv.amount_paid || 0), 0),
    [invoicesOverdue],
  );

  const kpisLoading = invoicesLoading || statsLoading || tasksLoading || leadsLoading || dashLoading;

  const name = firstName(user);
  const currency = invoices[0]?.currency ?? "usd";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {name ? `, ${name}` : ""} 👋
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Vista general de {userCtx?.workspaces?.[0]?.workspace?.name ?? "tu agencia"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewClientOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNewProjectOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo proyecto
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/app/calendario")}>
            <Plus className="mr-1 h-4 w-4" /> Nueva publicación
          </Button>
          <Button size="sm" onClick={() => setNewInvoiceOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nueva factura
          </Button>
        </div>
      </header>

      {/* KPIs */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Link to="/app/finanzas">
            <KpiCard
              label="Revenue este mes"
              value={formatMoney(revenueThisMonth, currency)}
              hint="Facturas cobradas"
              className="cursor-pointer transition-colors hover:border-primary/50"
            />
          </Link>
          <Link to="/app/proyectos">
            <KpiCard
              label="Proyectos activos"
              value={projectsStats?.totalActive ?? 0}
              hint={`${projectsStats?.inProgress ?? 0} en curso`}
              className="cursor-pointer transition-colors hover:border-primary/50"
            />
          </Link>
          <Link to="/app/tareas">
            <KpiCard
              label="Tareas vencidas"
              value={overdueTasks.length}
              hint={overdueTasks.length ? "Requieren atención" : "Todo al día"}
              className="cursor-pointer transition-colors hover:border-primary/50"
            />
          </Link>
          <Link to="/app/calendario">
            <KpiCard
              label="Aprobaciones pendientes"
              value={dash?.postsPendingApproval ?? 0}
              hint="Esperando cliente"
              className="cursor-pointer transition-colors hover:border-primary/50"
            />
          </Link>
          <Link to="/app/ventas">
            <KpiCard
              label="Leads en pipeline"
              value={leadsInPipeline}
              hint="Activos en ventas"
              className="cursor-pointer transition-colors hover:border-primary/50"
            />
          </Link>
        </div>
      )}

      {/* Today view */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ListTodo className="h-4 w-4 text-primary" /> Tareas críticas hoy
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/tareas">
                Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : criticalTasksToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Sin pendientes urgentes hoy</p>
              </div>
            ) : (
              criticalTasksToday.map((t) => {
                const due = t.due_date ? parseISO(t.due_date) : null;
                const overdue = due && isPast(due) && !isToday(due);
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/app/tareas?task=${t.id}`)}
                    className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                  >
                    <Badge className={PRIORITY_CLASS[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{t.title}</div>
                      {due && (
                        <div className={`mt-0.5 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {overdue ? "Vencida " : "Vence hoy"}
                          {overdue && format(due, "d MMM", { locale: es })}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarCheck className="h-4 w-4 text-primary" /> Posts programados hoy
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/calendario">
                Ver calendario <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : !dash?.postsToday.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay publicaciones programadas hoy</p>
              </div>
            ) : (
              dash.postsToday.map((p) => (
                <Link
                  key={p.id}
                  to={`/app/calendario?post=${p.id}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-1">
                    {(p.channels ?? []).slice(0, 3).map((ch) => (
                      <ChannelIcon key={ch} channel={ch as Channel} className="h-4 w-4" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {p.caption?.split("\n")[0] || "Sin caption"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.client_name} · {format(parseISO(p.scheduled_for), "HH:mm")}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {p.status === "scheduled" ? "Agendado" : "Aprobado"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Alerts */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-foreground">Alertas</h2>
        {kpisLoading || contractsLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AlertCard
              icon={<FileWarning className="h-4 w-4" />}
              tone={contractsExpiring.length > 0 ? "warning" : "muted"}
              title="Contratos por vencer"
              body={
                contractsExpiring.length === 0
                  ? "Sin contratos venciendo en los próximos 30 días"
                  : `${contractsExpiring.length} ${contractsExpiring.length === 1 ? "contrato vence" : "contratos vencen"} en los próximos 30 días`
              }
              to="/app/contratos"
            />
            <AlertCard
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={invoicesOverdue.length > 0 ? "danger" : "muted"}
              title="Pagos atrasados"
              body={
                invoicesOverdue.length === 0
                  ? "No hay facturas vencidas"
                  : `${invoicesOverdue.length} ${invoicesOverdue.length === 1 ? "factura vencida" : "facturas vencidas"} · ${formatMoney(overdueTotal, currency)} pendiente`
              }
              to="/app/finanzas"
            />
            <AlertCard
              icon={<Clock className="h-4 w-4" />}
              tone={(dash?.stalePostsCount ?? 0) > 0 ? "warning" : "muted"}
              title="Aprobaciones estancadas"
              body={
                (dash?.stalePostsCount ?? 0) === 0
                  ? "Todas las aprobaciones dentro de las 48h"
                  : `${dash?.stalePostsCount} ${dash?.stalePostsCount === 1 ? "publicación espera" : "publicaciones esperan"} respuesta hace más de 48h`
              }
              to="/app/calendario"
            />
          </div>
        )}
      </section>

      {/* Dialogs */}
      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        workspaceId={workspaceId}
      />
      <NewProjectGlobalDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        workspaceId={workspaceId}
        clients={clientOptions}
        onCreateClient={() => {
          setNewProjectOpen(false);
          setNewClientOpen(true);
        }}
      />
      <NewInvoiceDialog
        open={newInvoiceOpen}
        onOpenChange={setNewInvoiceOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}

function AlertCard({
  icon,
  title,
  body,
  to,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  tone: "danger" | "warning" | "muted";
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-orange-500/40 bg-orange-500/5"
        : "border-border";
  const iconClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-orange-600 dark:text-orange-400"
        : "text-muted-foreground";
  return (
    <Link
      to={to}
      className={`group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${toneClass}`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
