import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
  useUpdateLead,
  type LeadRow,
  type LeadStage,
} from "@/hooks/useSales";
import type { TeamMember } from "@/hooks/useTeam";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function LeadCard({
  lead,
  members,
  onOpen,
}: {
  lead: LeadRow;
  members: TeamMember[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });
  const assigned = members.find((m) => m.user_id === lead.assigned_to);
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={cn(
          "cursor-grab space-y-2 p-3 transition active:cursor-grabbing",
          isDragging && "rotate-1 opacity-70 shadow-lg",
        )}
        onClick={onOpen}
      >
        <div>
          <h4 className="line-clamp-1 text-sm font-medium">{lead.company_name}</h4>
          <p className="line-clamp-1 text-xs text-muted-foreground">{lead.contact_name}</p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {lead.estimated_value != null ? usd.format(Number(lead.estimated_value)) : "—"}
          </span>
          <Badge variant="secondary" className="h-5">
            {lead.probability}%
          </Badge>
        </div>
        {assigned && (
          <div className="flex items-center gap-2 pt-1">
            <Avatar className="h-5 w-5 text-[9px]">
              {assigned.avatar_url && <AvatarImage src={assigned.avatar_url} />}
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {(assigned.full_name || assigned.email || "?")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[11px] text-muted-foreground">
              {assigned.full_name || assigned.email}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

function Column({
  stage,
  leads,
  members,
  onOpen,
  isOver,
}: {
  stage: LeadStage;
  leads: LeadRow[];
  members: TeamMember[];
  onOpen: (l: LeadRow) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-muted/30 p-3 transition md:w-auto md:min-w-0",
        isOver && "border-secondary ring-2 ring-secondary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{LEAD_STAGE_LABEL[stage]}</h3>
        <Badge variant="secondary" className="h-5">
          {leads.length}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {leads.length === 0 && (
          <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
            Sin leads
          </p>
        )}
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} members={members} onOpen={() => onOpen(l)} />
        ))}
      </div>
    </div>
  );
}

export function LeadsKanban({
  leads,
  members,
  workspaceId,
  onOpen,
  onWonRequestConvert,
}: {
  leads: LeadRow[];
  members: TeamMember[];
  workspaceId: string | undefined;
  onOpen: (l: LeadRow) => void;
  onWonRequestConvert: (l: LeadRow) => void;
}) {
  const update = useUpdateLead(workspaceId);
  const [active, setActive] = useState<LeadRow | null>(null);
  const [overCol, setOverCol] = useState<LeadStage | null>(null);
  const [lostLead, setLostLead] = useState<LeadRow | null>(null);
  const [lostReason, setLostReason] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped: Record<LeadStage, LeadRow[]> = {
    lead: [],
    diagnostico: [],
    propuesta_enviada: [],
    negociacion: [],
    ganado: [],
    perdido: [],
  };
  for (const l of leads) grouped[l.stage].push(l);

  const handleStart = (e: DragStartEvent) => {
    const l = (e.active.data.current as any)?.lead as LeadRow | undefined;
    setActive(l ?? null);
  };

  const handleEnd = async (e: DragEndEvent) => {
    setActive(null);
    setOverCol(null);
    const overId = e.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("col:")) return;
    const target = overId.slice(4) as LeadStage;
    const l = (e.active.data.current as any)?.lead as LeadRow | undefined;
    if (!l || l.stage === target) return;

    if (target === "perdido") {
      setLostLead(l);
      setLostReason(l.lost_reason ?? "");
      return;
    }

    try {
      await update.mutateAsync({ leadId: l.id, patch: { stage: target } });
      if (target === "ganado") {
        onWonRequestConvert(l);
      } else {
        toast.success(`Movido a ${LEAD_STAGE_LABEL[target]}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar");
    }
  };

  const confirmLost = async () => {
    if (!lostLead) return;
    try {
      await update.mutateAsync({
        leadId: lostLead.id,
        patch: { stage: "perdido", lost_reason: lostReason.trim() || null },
      });
      toast.success("Marcado como perdido");
      setLostLead(null);
      setLostReason("");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar");
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleStart}
        onDragOver={(e) => {
          const id = e.over?.id;
          setOverCol(typeof id === "string" && id.startsWith("col:") ? (id.slice(4) as LeadStage) : null);
        }}
        onDragEnd={handleEnd}
        onDragCancel={() => {
          setActive(null);
          setOverCol(null);
        }}
      >
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-6 md:overflow-visible">
          {LEAD_STAGE_ORDER.map((s) => (
            <Column
              key={s}
              stage={s}
              leads={grouped[s]}
              members={members}
              onOpen={onOpen}
              isOver={overCol === s}
            />
          ))}
        </div>
        <DragOverlay>
          {active && (
            <div className="w-72 opacity-90">
              <LeadCard lead={active} members={members} onOpen={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!lostLead} onOpenChange={(v) => !v && setLostLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
            <DialogDescription>Contanos brevemente por qué se perdió este lead.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (opcional pero recomendado)"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostLead(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmLost} disabled={update.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
