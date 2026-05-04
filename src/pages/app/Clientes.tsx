import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients, type ClientStatus } from "@/hooks/useClients";
import { ClientsFilters, type ViewMode } from "@/components/clients/clients-filters";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsGrid } from "@/components/clients/clients-grid";
import { ClientsEmptyState } from "@/components/clients/clients-empty-state";
import { NewClientDialog } from "@/components/clients/new-client-dialog";

export default function Clientes() {
  const { workspace } = useActiveWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [industry, setIndustry] = useState<string>("all");
  const [location, setLocation] = useState<string>("Dallas-Fort Worth, TX");
  const [view, setView] = useState<ViewMode>("table");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients, isLoading } = useClients(workspace?.id, {
    search,
    status,
    industry,
    location,
  });

  const hasFilters =
    search.length > 0 ||
    status !== "all" ||
    industry !== "all" ||
    location !== "Dallas-Fort Worth, TX";

  const showEmpty = !isLoading && (clients?.length ?? 0) === 0 && !hasFilters;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Gestiona todos tus clientes en un solo lugar
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 self-start md:self-auto">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </header>

      {!showEmpty && (
        <ClientsFilters
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          industry={industry}
          onIndustry={setIndustry}
          location={location}
          onLocation={setLocation}
          view={view}
          onView={setView}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : showEmpty ? (
        <ClientsEmptyState onCreate={() => setDialogOpen(true)} />
      ) : (clients?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          No hay clientes que coincidan con los filtros.
        </div>
      ) : view === "table" ? (
        <ClientsTable clients={clients!} />
      ) : (
        <ClientsGrid clients={clients!} />
      )}

      <NewClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={workspace?.id}
      />
    </div>
  );
}
