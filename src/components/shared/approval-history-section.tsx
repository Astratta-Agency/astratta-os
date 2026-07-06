import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApprovalHistory,
  type ApprovalHistoryAction,
  type ApprovalHistoryEntry,
} from "@/hooks/useApprovalHistory";

const ACTION_META: Record<
  ApprovalHistoryAction,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  sent_for_approval: { label: "Enviado para aprobación", icon: Send, tone: "text-muted-foreground" },
  resent: { label: "Reenviado", icon: RefreshCw, tone: "text-muted-foreground" },
  approved: { label: "Aprobado", icon: CheckCircle2, tone: "text-emerald-600" },
  rejected: { label: "Rechazado", icon: XCircle, tone: "text-destructive" },
  changes_requested: { label: "Cambios solicitados", icon: MessageSquare, tone: "text-amber-600" },
  auto_expired: { label: "Solicitud expirada", icon: Clock, tone: "text-muted-foreground" },
};

/** Fallback when RLS hides the actor profile from the viewer. */
function actorFallback(action: ApprovalHistoryAction) {
  return action === "approved" || action === "rejected" || action === "changes_requested"
    ? "Cliente"
    : "Equipo";
}

interface Props {
  postId: string | undefined;
  className?: string;
  /** Compact hides the title header (e.g. inside the portal card). */
  title?: string | null;
  emptyText?: string;
}

export function ApprovalHistorySection({
  postId,
  className,
  title = "Comentarios y aprobaciones",
  emptyText = "Aún no hay actividad de aprobación.",
}: Props) {
  const { data: entries = [], isLoading } = useApprovalHistory(postId);

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      {title && (
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          {title}
        </p>
      )}
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">Cargando…</p>
      ) : entries.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <HistoryItem key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryItem({ entry }: { entry: ApprovalHistoryEntry }) {
  const meta = ACTION_META[entry.action] ?? ACTION_META.sent_for_approval;
  const Icon = meta.icon;
  return (
    <li className="flex gap-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className={cn("font-semibold", meta.tone)}>{meta.label}</span>
          <span className="text-muted-foreground">
            {" · "}
            {entry.actor_name ?? actorFallback(entry.action)}
            {" · "}
            {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
          </span>
        </p>
        {entry.comment && (
          <blockquote className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
            {entry.comment}
          </blockquote>
        )}
      </div>
    </li>
  );
}
