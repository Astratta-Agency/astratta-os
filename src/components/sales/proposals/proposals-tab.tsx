import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Copy,
  Eye,
  FileText,
  FileSignature,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
  useDeleteProposal,
  useDuplicateAsNewVersion,
  useMarkProposalSent,
  useProposalEvents,
  useProposalSignature,
  useProposalsForLead,
  type ProposalRow,
  type ProposalStatus,
} from "@/hooks/useProposals";
import { ProposalEditor } from "./proposal-editor";
import { useCreateContractFromProposal } from "@/hooks/useContracts";
import { toast as sonnerToast } from "sonner";

const statusColor: Record<ProposalStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  viewed: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  negotiation: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  signed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
};

type Props = {
  leadId: string;
  workspaceId: string | undefined;
  isOwner: boolean;
};

export function ProposalsTab({ leadId, workspaceId, isOwner }: Props) {
  const navigate = useNavigate();
  const { data: proposals = [], isLoading } = useProposalsForLead(leadId);
  const mark = useMarkProposalSent();
  const dup = useDuplicateAsNewVersion();
  const del = useDeleteProposal();
  const createContract = useCreateContractFromProposal(workspaceId);

  const handleGenerateContract = async (p: ProposalRow) => {
    try {
      const c = await createContract.mutateAsync(p.id);
      sonnerToast.success("Contrato creado en borrador");
      navigate(`/app/contratos/${c.id}`);
    } catch (e: any) {
      sonnerToast.error(e?.message ?? "No se pudo crear el contrato");
    }
  };

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ProposalRow | null>(null);
  const [preview, setPreview] = useState<ProposalRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProposalRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setEditorMode("create");
    setEditorOpen(true);
  };
  const openEdit = (p: ProposalRow) => {
    setEditing(p);
    setEditorMode("edit");
    setEditorOpen(true);
  };

  const copyLink = async (p: ProposalRow) => {
    const url = `${window.location.origin}/propuestas/${p.public_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  const handleMarkSent = async (p: ProposalRow) => {
    try {
      await mark.mutateAsync({ id: p.id, leadId: p.lead_id });
      toast.success("Propuesta marcada como enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar");
    }
  };

  const handleDuplicate = async (p: ProposalRow) => {
    try {
      await dup.mutateAsync(p.id);
      toast.success(`Versión v${(p.version ?? 1) + 1} creada`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo duplicar");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync({ id: confirmDelete.id, leadId: confirmDelete.lead_id });
      toast.success("Propuesta eliminada");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {proposals.length} {proposals.length === 1 ? "propuesta" : "propuestas"}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva propuesta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no hay propuestas. Creá la primera para compartir con el cliente.
        </div>
      ) : (
        <ul className="space-y-2">
          {proposals.map((p) => (
            <ProposalRowCard
              key={p.id}
              proposal={p}
              isOwner={isOwner}
              onEdit={() => openEdit(p)}
              onPreview={() => setPreview(p)}
              onCopyLink={() => copyLink(p)}
              onMarkSent={() => handleMarkSent(p)}
              onDuplicate={() => handleDuplicate(p)}
              onDelete={() => setConfirmDelete(p)}
              onGenerateContract={() => handleGenerateContract(p)}
              contractPending={createContract.isPending}
            />
          ))}
        </ul>
      )}

      {editorOpen && (
        <ProposalEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          mode={editorMode}
          workspaceId={workspaceId}
          leadId={leadId}
          isOwner={isOwner}
          existing={editing}
        />
      )}

      {preview && (
        <ProposalPreviewDialog proposal={preview} onClose={() => setPreview(null)} />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar propuesta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
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
    </div>
  );
}

function ProposalRowCard({
  proposal: p,
  isOwner,
  onEdit,
  onPreview,
  onCopyLink,
  onMarkSent,
  onDuplicate,
  onDelete,
  onGenerateContract,
  contractPending,
}: {
  proposal: ProposalRow;
  isOwner: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onCopyLink: () => void;
  onMarkSent: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGenerateContract: () => void;
  contractPending: boolean;
}) {
  const events = useProposalEvents(p.status !== "draft" ? p.id : undefined);
  const sig = useProposalSignature(p.status === "signed" ? p.id : undefined);
  const isDraft = p.status === "draft";
  const canVersion = ["sent", "viewed", "rejected", "expired", "negotiation"].includes(p.status);
  const viewEvents = (events.data ?? []).filter((e) => e.event_type === "viewed");

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{p.title}</span>
            <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
            <span className="text-xs text-muted-foreground">{PROPOSAL_TYPE_LABEL[p.type]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[p.status]}`}>
              {PROPOSAL_STATUS_LABEL[p.status]}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {p.currency.toUpperCase()} {Number(p.total_amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            {" · "}
            {format(new Date(p.created_at), "d MMM yyyy")}
            {p.valid_until && ` · Válida hasta ${format(new Date(p.valid_until), "d MMM yyyy")}`}
          </div>
          {p.status === "signed" && sig.data && (
            <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Firmada por {sig.data.signer_name} el{" "}
              {format(new Date(sig.data.signed_at), "d MMM yyyy HH:mm")}
            </div>
          )}
          {viewEvents.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              Vista {viewEvents.length} {viewEvents.length === 1 ? "vez" : "veces"} · última:{" "}
              {format(new Date(viewEvents[0].occurred_at), "d MMM HH:mm")}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {isDraft ? (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Editar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onPreview}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              Ver
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onCopyLink}>
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copiar link
          </Button>
          {isDraft && (
            <Button size="sm" onClick={onMarkSent}>
              <Send className="mr-1 h-3.5 w-3.5" />
              Marcar como enviada
            </Button>
          )}
          {canVersion && (
            <Button size="sm" variant="outline" onClick={onDuplicate}>
              <GitBranch className="mr-1 h-3.5 w-3.5" />
              Nueva versión
            </Button>
          )}
          {p.status === "signed" && (
            <Button size="sm" onClick={onGenerateContract} disabled={contractPending}>
              {contractPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSignature className="mr-1 h-3.5 w-3.5" />
              )}
              Generar contrato
            </Button>
          )}
          {isOwner && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function ProposalPreviewDialog({ proposal, onClose }: { proposal: ProposalRow; onClose: () => void }) {
  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{proposal.title}</AlertDialogTitle>
          <AlertDialogDescription>
            Vista previa (solo lectura). Para modificar, creá una nueva versión.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          {proposal.content.map((b) => (
            <div key={b.id} className="rounded-lg border p-3">
              <h4 className="mb-2 font-semibold">{b.title}</h4>
              {b.type === "text" && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{b.body}</p>}
              {b.type === "services" && (
                <ul className="space-y-1 text-sm">
                  {b.items.map((it, i) => (
                    <li key={i}>
                      <span className="font-medium">{it.name}</span>
                      {it.description && <span className="text-muted-foreground"> — {it.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {b.type === "deliverables" && (
                <ul className="ml-4 list-disc space-y-1 text-sm">
                  {b.items.map((it, i) => <li key={i}>{it.label}</li>)}
                </ul>
              )}
              {b.type === "timeline" && (
                <ul className="space-y-1 text-sm">
                  {b.items.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{it.name}</span>
                      <span className="text-muted-foreground">{it.when}</span>
                    </li>
                  ))}
                </ul>
              )}
              {b.type === "pricing" && (
                <table className="w-full text-sm">
                  <tbody>
                    {b.items.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1">{it.name}</td>
                        <td className="py-1 text-right">{it.quantity}</td>
                        <td className="py-1 text-right tabular-nums">
                          {(it.quantity * it.unit_price).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold">
              {proposal.currency.toUpperCase()} {Number(proposal.total_amount).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cerrar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
