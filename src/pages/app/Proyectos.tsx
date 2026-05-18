import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import {
  useProjects,
  useProjectsStats,
  useUpdateProjectStatus,
  useWorkspaceMembers,
  type ProjectRow,
} from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { ProjectsKpiBar } from "@/components/projects/projects-kpi-bar";
import { ProjectsFiltersBar, type View } from "@/components/projects/projects-filters-bar";
import { ProjectsTable } from "@/components/projects/projects-table";
import { ProjectsKanban } from "@/components/projects/projects-kanban";
import { NewProjectGlobalDialog } from "@/components/projects/new-project-global-dialog";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPES,
} from "@/components/projects/project-meta";
import type { ProjectStatus, ProjectType } from "@/integrations/supabase/database.types";

type KpiKey = "all-active" | "in_progress" | "paused" | "delivered-month" | "overdue";

const parseList = (v: string | null): string[] =>
  v ? v.split(",").filter(Boolean) : [];

export default function Proyectos() {
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const [params, setParams] = useSearchParams();

  const search = params.get("q") ?? "";
  const clientIds = parseList(params.get("clients"));
  const types = parseList(params.get("types")) as ProjectType[];
  const statuses = parseList(params.get("status")) as ProjectStatus[];
  const assignedToMe = params.get("me") === "1";
  const view = (params.get("view") as View) || "lista";

  const update = (next: Record<string, string | string[] | boolean | null | undefined>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || v === false) {
        p.delete(k);
      } else if (Array.isArray(v)) {
        p.set(k, v.join(","));
      } else if (v === true) {
        p.set(k, "1");
      } else {
        p.set(k, String(v));
      }
    });
    setParams(p, { replace: true });
  };

  const [debouncedSearch] = useDebounce(search, 300);

  const { data: clientsList = [] } = useClients(workspaceId, { search: "", status: "all", industry: "all", location: "all" });
  const clientOptions = clientsList.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  const { data: stats, isLoading: statsLoading } = useProjectsStats(workspaceId);

  const { data: projects = [], isLoading } = useProjects(workspaceId, {
    search: debouncedSearch,
    clientIds,
    types,
    statuses,
    assignedToMe,
    currentUserId: user?.id ?? null,
  });

  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  const updateStatus = useUpdateProjectStatus();

  const [newOpen, setNewOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (clientIds.length) n++;
    if (types.length) n++;
    if (statuses.length) n++;
    if (assignedToMe) n++;
    if (search) n++;
    return n;
  }, [clientIds, types, statuses, assignedToMe, search]);

  const clearFilters = () =>
    update({ q: null, clients: null, types: null, status: null, me: null });

  const activeKpi: KpiKey | null = useMemo(() => {
    const setEq = (a: string[], b: string[]) =>
      a.length === b.length && a.every((v) => b.includes(v));
    if (setEq(statuses, ["planning", "in_progress"])) return "all-active";
    if (setEq(statuses, ["in_progress"])) return "in_progress";
    if (setEq(statuses, ["paused"])) return "paused";
    return null;
  }, [statuses]);

  const handleKpi = (key: KpiKey) => {
    switch (key) {
      case "all-active":
        update({ status: ["planning", "in_progress"] });
        break;
      case "in_progress":
        update({ status: ["in_progress"] });
        break;
      case "paused":
        update({ status: ["paused"] });
        break;
      case "delivered-month":
        update({ status: ["delivered"] });
        toast("Mostrando entregados (filtra por fecha en la tabla)");
        break;
      case "overdue":
        update({ status: ["planning", "in_progress"] });
        toast("Revisa la columna Deadline para los vencidos");
        break;
    }
  };

  const handleOpenProject = (_p: ProjectRow) => {
    toast("Detalle de proyecto próximamente");
  };

  const handleStatusChange = async (p: ProjectRow, to: ProjectStatus) => {
    if (!workspaceId) return;
    try {
      await updateStatus.mutateAsync({
        projectId: p.id,
        fromStatus: p.status,
        toStatus: to,
        workspaceId,
        clientId: p.client_id,
        projectName: p.name,
      });
      toast.success(`Movido a ${PROJECT_STATUS_LABEL[to]}`);
    } catch (e: any) {
      toast.error("No se pudo actualizar el estado", { description: e?.message });
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Todos los proyectos activos en tu agencia
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo proyecto
        </Button>
      </header>

      <ProjectsKpiBar
        stats={stats}
        loading={statsLoading}
        activeFilter={activeKpi}
        onSelect={handleKpi}
        onClear={clearFilters}
        filtersActive={activeFiltersCount > 0}
      />

      <ProjectsFiltersBar
        search={search}
        onSearch={(v) => update({ q: v })}
        clientIds={clientIds}
        onClientIds={(v) => update({ clients: v })}
        clientOptions={clientOptions}
        types={types}
        onTypes={(v) => update({ types: v })}
        statuses={statuses}
        onStatuses={(v) => update({ status: v })}
        assignedToMe={assignedToMe}
        onAssignedToMe={(v) => update({ me: v })}
        view={view}
        onView={(v) => update({ view: v === "lista" ? null : v })}
        activeFiltersCount={activeFiltersCount}
      />

      {view === "lista" ? (
        <ProjectsTable
          rows={projects}
          members={members}
          loading={isLoading}
          onOpenProject={handleOpenProject}
          onChangeStatus={handleStatusChange}
          onArchive={() => toast("Próximamente")}
          onClearFilters={clearFilters}
        />
      ) : (
        <ProjectsKanban
          rows={projects}
          members={members}
          onOpenProject={handleOpenProject}
          onStatusChange={handleStatusChange}
        />
      )}

      <NewProjectGlobalDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workspaceId={workspaceId}
        clients={clientOptions}
        onCreateClient={() => {
          setNewOpen(false);
          setNewClientOpen(true);
        }}
      />
      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}
