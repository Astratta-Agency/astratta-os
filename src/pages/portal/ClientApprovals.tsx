import { useEffect, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useApprovalsByStatus } from "@/hooks/portal/usePendingApprovals";
import { ApprovalCard } from "@/components/portal/approval-card";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";
import type { PostStatus } from "@/lib/post-states";

const TABS: { value: string; label: string; statuses: PostStatus[] }[] = [
  { value: "pendientes", label: "Pendientes", statuses: ["pending_approval"] },
  { value: "aprobados", label: "Aprobados", statuses: ["approved", "scheduled", "published"] },
  { value: "cambios", label: "Cambios solicitados", statuses: ["changes_requested"] },
  { value: "rechazados", label: "Rechazados", statuses: ["rejected"] },
];

export default function ClientApprovals() {
  const ctx = useOutletContext<PortalContext>();
  const [params, setParams] = useSearchParams();
  const deepPostId = params.get("post");
  const [tab, setTab] = useState("pendientes");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: pending = [] } = useApprovalsByStatus(ctx.client.id, ["pending_approval"]);
  const { data: approved = [] } = useApprovalsByStatus(ctx.client.id, [
    "approved",
    "scheduled",
    "published",
  ]);
  const { data: changes = [] } = useApprovalsByStatus(ctx.client.id, ["changes_requested"]);
  const { data: rejected = [] } = useApprovalsByStatus(ctx.client.id, ["rejected"]);

  // Auto-switch tab to the one containing the deep-linked post
  useEffect(() => {
    if (!deepPostId) return;
    if (pending.some((p) => p.id === deepPostId)) setTab("pendientes");
    else if (approved.some((p) => p.id === deepPostId)) setTab("aprobados");
    else if (changes.some((p) => p.id === deepPostId)) setTab("cambios");
    else if (rejected.some((p) => p.id === deepPostId)) setTab("rechazados");
  }, [deepPostId, pending, approved, changes, rejected]);

  // Scroll to the highlighted card once it's mounted
  useEffect(() => {
    if (!deepPostId) return;
    const el = document.getElementById(`approval-${deepPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2");
      setTimeout(() => el.classList.remove("ring-2"), 2500);
    }
  }, [deepPostId, tab]);

  const lists: Record<string, typeof pending> = {
    pendientes: pending,
    aprobados: approved,
    cambios: changes,
    rechazados: rejected,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold">Aprobaciones</h1>
          {pending.length > 0 && (
            <Badge style={{ backgroundColor: "var(--portal-primary)", color: "white" }}>
              {pending.length} pendiente{pending.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (deepPostId) { params.delete("post"); setParams(params, { replace: true }); } }}>
        <TabsList className="grid w-full grid-cols-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {lists[t.value]?.length > 0 && (
                <span className="ml-2 rounded-full bg-muted px-1.5 text-[10px]">
                  {lists[t.value].length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => {
          const items = lists[t.value];
          return (
            <TabsContent key={t.value} value={t.value} className="mt-6">
              <div ref={scrollRef} className="space-y-4">
                {items.length === 0 ? (
                  <EmptyState pending={t.value === "pendientes"} />
                ) : (
                  items.map((p) => (
                    <ApprovalCard
                      key={p.id}
                      post={p}
                      clientId={ctx.client.id}
                      role={ctx.role}
                      readonly={t.value !== "pendientes"}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function EmptyState({ pending }: { pending: boolean }) {
  if (pending) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
        <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
        <p className="font-semibold">Estás al día</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No hay contenido pendiente de aprobación.
        </p>
      </div>
    );
  }
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Aún no hay posts en este estado.
    </p>
  );
}
