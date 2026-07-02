import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ExternalLink, MoreVertical, Pencil, Plus, UserPlus } from "lucide-react";
import { differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClient, useClientPendingTasksCount } from "@/hooks/useClientDetail";

import { ClientLogo } from "@/components/clients/client-logo";
import { StatusBadge } from "@/components/clients/status-badge";
import { HealthScoreDial } from "@/components/clients/health-score-dial";
import { KpiCard } from "@/components/clients/kpi-card";
import { TabComingSoon } from "@/components/clients/tab-coming-soon";
import { UpcomingDeliveries, StakeholdersList } from "@/components/clients/resumen-cards";
import { ClientContentRolesCard } from "@/components/clients/client-content-roles-card";
import { ClientProjectsTab } from "@/components/clients/client-projects-tab";
import { ClientCredentialsTab } from "@/components/clients/client-credentials-tab";
import { ClientDocumentsTab } from "@/components/clients/client-documents-tab";
import { ClientNotesTab } from "@/components/clients/client-notes-tab";
import { ClientTimelineTab } from "@/components/clients/client-timeline-tab";
import { NewProjectDialog } from "@/components/clients/new-project-dialog";
import { InviteClientUserDialog } from "@/components/clients/invite-client-user-dialog";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { ClientFinancesTab } from "@/components/clients/client-finances-tab";
import { useInvoices } from "@/hooks/useInvoices";
import { formatMoney } from "@/lib/money";
import { subDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

export default function ClienteDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: client, isLoading } = useClient(workspace?.id, slug);
  const { data: pendingTasks } = useClientPendingTasksCount(client?.id);
  const { data: clientInvoices = [] } = useInvoices(client?.workspace_id, { clientId: client?.id });
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (wsLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h2 className="font-display text-2xl font-bold">Cliente no encontrado</h2>
        <p className="text-sm text-muted-foreground">
          El cliente "{slug}" no existe en este workspace.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/clientes">
            <ArrowLeft className="h-4 w-4" /> Volver a clientes
          </Link>
        </Button>
      </div>
    );
  }

  const health = client.health_score;
  const activeProjects = client.projects.filter(
    (p) => p.status === "planning" || p.status === "in_progress",
  ).length;
  const daysAsClient = Math.max(0, differenceInDays(new Date(), new Date(client.created_at)));

  const ltv = clientInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total), 0);
  const mrrCutoff = subDays(new Date(), 35).toISOString().slice(0, 10);
  const mrr = clientInvoices
    .filter(
      (i) =>
        i.is_recurring &&
        (i.status === "sent" || i.status === "paid" || i.status === "partial") &&
        i.issue_date >= mrrCutoff,
    )
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/app/clientes" className="hover:text-foreground">
          Clientes
        </Link>
        <span>/</span>
        <span className="text-foreground">{client.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <ClientLogo
            name={client.name}
            logoUrl={client.logo_url}
            brandColor={client.brand_primary_color}
            size="lg"
          />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {client.industry && <span>{client.industry}</span>}
              {client.industry && <span>·</span>}
              <span>{client.location}</span>
              <StatusBadge status={client.status} />
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" /> Website
                </a>
              )}
            </div>
            <HealthScoreDial score={health} label="Health score" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button onClick={() => setNewProjectOpen(true)}>
              <Plus className="h-4 w-4" /> Crear proyecto
            </Button>
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invitar al portal
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/portal/${client.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" /> Ver portal cliente
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Disponible una vez invites al cliente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setNewProjectOpen(true)}>
              <Plus className="h-4 w-4" /> Proyecto
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Invitar al portal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`/portal/${client.slug}`, "_blank")}>
                  <ExternalLink className="h-4 w-4" /> Ver portal cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>


      {/* Tabs */}
      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="proyectos">Proyectos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="finanzas">Finanzas</TabsTrigger>
          <TabsTrigger value="credenciales">Credenciales</TabsTrigger>
          <TabsTrigger value="notas">Notas internas</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="LTV" value={formatMoney(ltv)} hint="Suma de facturas pagadas" />
            <KpiCard label="MRR" value={formatMoney(mrr)} hint="Recurrentes últimos 35 días (heurístico)" />
            <KpiCard label="Proyectos activos" value={activeProjects} />
            <KpiCard label="Posts este mes" value="—" hint="Próximamente" />
            <KpiCard label="Tareas pendientes" value={pendingTasks ?? 0} />
            <KpiCard label="Días como cliente" value={daysAsClient} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <UpcomingDeliveries projects={client.projects} />
            <StakeholdersList contacts={client.client_contacts} clientId={client.id} />
            <ClientContentRolesCard clientId={client.id} workspaceId={client.workspace_id} />
          </div>
        </TabsContent>

        {/* Proyectos */}
        <TabsContent value="proyectos">
          <ClientProjectsTab
            workspaceId={client.workspace_id}
            clientId={client.id}
            projects={client.projects}
          />
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <ClientDocumentsTab clientId={client.id} workspaceId={client.workspace_id} />
        </TabsContent>

        {/* Finanzas */}
        <TabsContent value="finanzas">
          <ClientFinancesTab workspaceId={client.workspace_id} clientId={client.id} />
        </TabsContent>

        {/* Credenciales */}
        <TabsContent value="credenciales">
          <ClientCredentialsTab clientId={client.id} workspaceId={client.workspace_id} />
        </TabsContent>

        {/* Notas */}
        <TabsContent value="notas">
          <ClientNotesTab clientId={client.id} />
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <ClientTimelineTab clientId={client.id} workspaceId={client.workspace_id} />
        </TabsContent>
      </Tabs>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        workspaceId={client.workspace_id}
        clientId={client.id}
      />
      <InviteClientUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        clientId={client.id}
        clientSlug={client.slug}
        clientName={client.name}
      />
      <EditClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={client.workspace_id}
        client={{
          id: client.id,
          name: client.name,
          industry: client.industry,
          website: client.website,
          location: client.location,
          status: client.status,
          brand_primary_color: client.brand_primary_color,
          brand_secondary_color: client.brand_secondary_color,
          logo_url: client.logo_url,
        }}
      />
    </div>
  );
}
