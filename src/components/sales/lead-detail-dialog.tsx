import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
  useDeleteLead,
  useUpdateLead,
  type LeadRow,
  type LeadSource,
  type LeadStage,
} from "@/hooks/useSales";
import type { TeamMember } from "@/hooks/useTeam";
import { DiagnosticChecklist } from "./diagnostic-checklist";
import { ProposalsTab } from "./proposals/proposals-tab";

type Props = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | undefined;
  currentUserId: string | null;
  isOwner: boolean;
  members: TeamMember[];
  onRequestConvert: (l: LeadRow) => void;
};

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  workspaceId,
  currentUserId,
  isOwner,
  members,
  onRequestConvert,
}: Props) {
  const update = useUpdateLead(workspaceId);
  const del = useDeleteLead();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState<Partial<LeadRow>>({});

  useEffect(() => {
    if (lead) setForm(lead);
  }, [lead?.id]);

  if (!lead) return null;

  const canEdit = isOwner || lead.assigned_to === currentUserId;

  const setField = <K extends keyof LeadRow>(k: K, v: LeadRow[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    try {
      const patch: any = {};
      const keys: (keyof LeadRow)[] = [
        "company_name",
        "contact_name",
        "contact_email",
        "contact_phone",
        "source",
        "stage",
        "estimated_value",
        "probability",
        "expected_close_date",
        "lost_reason",
        "notes",
        "service_interest",
        "assigned_to",
      ];
      for (const k of keys) {
        if ((form as any)[k] !== (lead as any)[k]) patch[k] = (form as any)[k];
      }
      if (Object.keys(patch).length === 0) {
        toast.info("Sin cambios");
        return;
      }
      await update.mutateAsync({ leadId: lead.id, patch });
      toast.success("Lead actualizado");
      if (patch.stage === "ganado") onRequestConvert({ ...lead, ...form } as LeadRow);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar");
    }
  };

  const handleDelete = async () => {
    try {
      await del.mutateAsync(lead.id);
      toast.success("Lead eliminado");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lead.company_name}</DialogTitle>
            <DialogDescription>
              Creado {format(new Date(lead.created_at), "d MMM yyyy")} · Fuente: {LEAD_SOURCE_LABEL[lead.source]}
              {lead.converted_client_id && " · Convertido a cliente"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
              <TabsTrigger value="propuestas">Propuestas</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Empresa</Label>
                  <Input
                    value={form.company_name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("company_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Contacto</Label>
                  <Input
                    value={form.contact_name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("contact_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.contact_email ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("contact_email", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={form.contact_phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("contact_phone", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Etapa</Label>
                  <Select
                    value={(form.stage as string) ?? "lead"}
                    disabled={!canEdit}
                    onValueChange={(v) => setField("stage", v as LeadStage)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STAGE_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEAD_STAGE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fuente</Label>
                  <Select
                    value={(form.source as string) ?? "organic"}
                    disabled={!canEdit}
                    onValueChange={(v) => setField("source", v as LeadSource)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LEAD_SOURCE_LABEL) as LeadSource[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEAD_SOURCE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor estimado (USD)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.estimated_value ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setField(
                        "estimated_value",
                        e.target.value === "" ? null : (Number(e.target.value) as any),
                      )
                    }
                  />
                </div>
                <div>
                  <Label>Probabilidad (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.probability ?? 0}
                    disabled={!canEdit}
                    onChange={(e) => setField("probability", Number(e.target.value) as any)}
                  />
                </div>
                <div>
                  <Label>Cierre esperado</Label>
                  <Input
                    type="date"
                    value={form.expected_close_date ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("expected_close_date", (e.target.value || null) as any)}
                  />
                </div>
                <div>
                  <Label>Servicio de interés</Label>
                  <Input
                    value={form.service_interest ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("service_interest", (e.target.value || null) as any)}
                  />
                </div>
                <div>
                  <Label>Asignado a</Label>
                  <Select
                    value={form.assigned_to ?? "none"}
                    disabled={!canEdit}
                    onValueChange={(v) => setField("assigned_to", (v === "none" ? null : v) as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {lead.referral_sources && lead.referral_sources.length > 0 && (
                <div>
                  <Label>¿Cómo nos conoció?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lead.referral_sources.join(", ")}
                  </p>
                </div>
              )}

              <div>
                <Label>Notas</Label>
                <Textarea
                  rows={3}
                  value={form.notes ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>

              {form.stage === "perdido" && (
                <div>
                  <Label>Motivo de pérdida</Label>
                  <Textarea
                    rows={2}
                    value={form.lost_reason ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField("lost_reason", e.target.value)}
                  />
                </div>
              )}

              <DialogFooter className="pt-2">
                {isOwner && (
                  <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
                {canEdit && (
                  <Button onClick={handleSave} disabled={update.isPending}>
                    {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                )}
              </DialogFooter>
            </TabsContent>

            <TabsContent value="diagnostico" className="pt-4">
              <DiagnosticChecklist lead={lead} workspaceId={workspaceId} />
            </TabsContent>

            <TabsContent value="propuestas" className="pt-4">
              <ProposalsTab leadId={lead.id} workspaceId={workspaceId} isOwner={isOwner} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar lead</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el lead y su diagnóstico asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
