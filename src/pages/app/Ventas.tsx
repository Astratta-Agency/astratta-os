import { useState } from "react";
import { Target, Plus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useUserContext } from "@/hooks/useUserContext";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeam";
import { useLeads, type LeadRow } from "@/hooks/useSales";
import { SalesForecastBar } from "@/components/sales/sales-forecast-bar";
import { LeadsKanban } from "@/components/sales/leads-kanban";
import { LeadsList } from "@/components/sales/leads-list";
import { NewLeadDialog } from "@/components/sales/new-lead-dialog";
import { LeadDetailDialog } from "@/components/sales/lead-detail-dialog";
import { ConvertLeadDialog } from "@/components/sales/convert-lead-dialog";
import { cn } from "@/lib/utils";

type View = "kanban" | "lista";

export default function Ventas() {
  const { workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: ctx } = useUserContext();
  const { user } = useAuth();
  const workspaceId = workspace?.id;
  const membership = ctx?.workspaces?.find((w) => w.workspace_id === workspaceId);
  const isOwner = membership?.role === "owner";

  const [view, setView] = useState<View>("kanban");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<LeadRow | null>(null);
  const [convertTarget, setConvertTarget] = useState<LeadRow | null>(null);

  const { data: leads = [], isLoading } = useLeads(workspaceId);
  const { data: members = [] } = useTeamMembers(workspaceId);

  const loading = wsLoading || !workspace || isLoading;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Ventas</h1>
            <p className="mt-1 text-base text-muted-foreground">Pipeline de leads y propuestas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-sm",
                view === "kanban" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={cn(
                "flex items-center gap-1 border-l px-3 py-1.5 text-sm",
                view === "lista" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
          </div>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo lead
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <SalesForecastBar leads={leads} />

          {view === "kanban" ? (
            <LeadsKanban
              leads={leads}
              members={members}
              workspaceId={workspaceId}
              onOpen={(l) => setDetail(l)}
              onWonRequestConvert={(l) => setConvertTarget(l)}
            />
          ) : (
            <LeadsList leads={leads} onOpen={(l) => setDetail(l)} />
          )}
        </>
      )}

      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} workspaceId={workspaceId} />
      <LeadDetailDialog
        lead={detail}
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        workspaceId={workspaceId}
        currentUserId={user?.id ?? null}
        isOwner={!!isOwner}
        members={members}
        onRequestConvert={(l) => setConvertTarget(l)}
      />
      <ConvertLeadDialog
        lead={convertTarget}
        workspaceId={workspaceId}
        open={!!convertTarget}
        onOpenChange={(v) => !v && setConvertTarget(null)}
      />
    </div>
  );
}
