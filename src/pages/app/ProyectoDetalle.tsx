import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, MoreVertical, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/hooks/useProjectDetail";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useWorkspaceMembers } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import {
  ProjectStatusBadge,
  PROJECT_TYPE_LABEL,
  computeProgress,
  isOverdue,
} from "@/components/projects/project-meta";
import { HealthScoreDial } from "@/components/clients/health-score-dial";
import { KpiCard } from "@/components/clients/kpi-card";
import { TabComingSoon } from "@/components/clients/tab-coming-soon";
import { ProjectDescriptionCard } from "@/components/projects/project-description-card";
import { ProjectTeamCard } from "@/components/projects/project-team-card";
import { ProjectTimelineTab } from "@/components/projects/project-timeline-tab";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";

const fmtMoney = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

export default function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: project, isLoading } = useProject(id);
  const { data: members = [] } = useWorkspaceMembers(workspace?.id);
  const { data: allClients = [] } = useClients(workspace?.id, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const activeClients = useMemo(
    () =>
      allClients
        .filter((c) => c.status === "active" || c.id === project?.client_id)
        .map((c) => ({ id: c.id, name: c.name })),
    [allClients, project?.client_id],
  );
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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h2 className="font-display text-2xl font-bold">Proyecto no encontrado</h2>
        <p className="text-sm text-muted-foreground">
          El proyecto "{id}" no existe en este workspace.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/proyectos">
            <ArrowLeft className="h-4 w-4" /> Volver a proyectos
          </Link>
        </Button>
      </div>
    );
  }

  const progress = computeProgress(project.status, project.start_date, project.end_date) ?? 0;
  const overdue = isOverdue(project.status, project.end_date);
  const daysLeft = project.end_date
    ? differenceInDays(new Date(project.end_date), new Date())
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/app/proyectos" className="hover:text-foreground">
          Proyectos
        </Link>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <ProjectAvatar name={project.name} size="lg" />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{PROJECT_TYPE_LABEL[project.type]}</span>
              <span>·</span>
              {project.client ? (
                <Link
                  to={`/app/clientes/${project.client.slug}`}
                  className="hover:text-foreground"
                >
                  {project.client.name}
                </Link>
              ) : (
                <span>—</span>
              )}
              <span>·</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <HealthScoreDial score={progress} label="Progreso" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button onClick={() => toast({ title: "Tareas próximamente" })}>
              <Plus className="h-4 w-4" /> Nueva tarea
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast({ title: "Duplicar próximamente" })}>
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: "Archivar próximamente" })}>
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => toast({ title: "Eliminar próximamente" })}
                >
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => toast({ title: "Tareas próximamente" })}>
              <Plus className="h-4 w-4" /> Tarea
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast({ title: "Duplicar próximamente" })}>
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: "Archivar próximamente" })}>
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => toast({ title: "Eliminar próximamente" })}
                >
                  Eliminar
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
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              label="Cliente"
              value={
                project.client ? (
                  <Link
                    to={`/app/clientes/${project.client.slug}`}
                    className="hover:underline"
                  >
                    {project.client.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <KpiCard
              label="Deadline"
              value={
                <span className={overdue ? "text-destructive" : undefined}>
                  {fmtDate(project.end_date)}
                </span>
              }
            />
            <KpiCard
              label="Días restantes"
              value={
                daysLeft == null ? (
                  "—"
                ) : (
                  <span className={daysLeft < 0 ? "text-destructive" : undefined}>
                    {daysLeft < 0 ? `${daysLeft}d` : `${daysLeft}d`}
                  </span>
                )
              }
            />
            <KpiCard label="Presupuesto" value={fmtMoney(project.budget_amount)} />
            <KpiCard label="Inicio" value={fmtDate(project.start_date)} />
            <KpiCard label="Progreso" value={`${progress}%`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ProjectDescriptionCard projectId={project.id} description={project.description} />
            <ProjectTeamCard memberIds={project.assigned_team_ids} allMembers={members} />
          </div>
        </TabsContent>

        {/* Tareas */}
        <TabsContent value="tareas" className="space-y-4">
          <TabComingSoon
            title="Las tareas de este proyecto aparecerán aquí"
            description="Podrás crear, asignar y hacer seguimiento de tareas directamente desde el proyecto."
          />
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled>
                      <Plus className="h-4 w-4" /> Nueva tarea
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Próximamente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TabsContent>

        {/* Archivos */}
        <TabsContent value="archivos">
          <TabComingSoon
            title="Archivos próximamente"
            description="Contratos, briefs, entregables y assets del proyecto se subirán a Supabase Storage en la siguiente iteración."
          />
        </TabsContent>

        {/* Actividad */}
        <TabsContent value="actividad">
          <ProjectTimelineTab
            projectId={project.id}
            clientId={project.client_id}
            workspaceId={project.workspace_id}
            projectName={project.name}
            projectCreatedAt={project.created_at}
          />
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        key={project.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        project={{
          id: project.id,
          workspace_id: project.workspace_id,
          client_id: project.client_id,
          name: project.name,
          type: project.type,
          status: project.status,
          start_date: project.start_date,
          end_date: project.end_date,
          budget_amount: project.budget_amount,
          progress: project.progress ?? null,
        }}
        clients={activeClients}
      />
    </div>
  );
}
