import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { POST_STATE_META, POST_STATE_TRANSITIONS, skipsClientApproval, type PostStatus } from "@/lib/post-states";

interface Props {
  status: PostStatus;
  onChange: (to: PostStatus) => void;
  /**
   * Called when the user selects `pending_approval` from the dropdown. When
   * provided, the dropdown will NOT apply the status change directly — instead
   * it delegates to this handler, which is expected to run the full approval
   * flow (preflight + email). This prevents bypassing preflight validation and
   * the client email notification.
   */
  onRequestApproval?: () => void;
  trigger?: React.ReactNode;
}

const DESTRUCTIVE: PostStatus[] = ["archived", "rejected"];

export function StateChangeDropdown({ status, onChange, onRequestApproval, trigger }: Props) {
  const [pending, setPending] = useState<PostStatus | null>(null);
  // Never surface `pending_approval` as a plain status change — it must go
  // through the dedicated "Enviar a cliente" flow (preflight + email).
  const transitions = (POST_STATE_TRANSITIONS[status] ?? []).filter(
    (t) => t !== "pending_approval",
  );

  const handleSelect = (to: PostStatus) => {
    if (DESTRUCTIVE.includes(to) || skipsClientApproval(status, to)) {
      setPending(to);
      return;
    }
    apply(to);
  };

  const apply = (to: PostStatus) => {
    onChange(to);
  };

  // Atajos que saltan la aprobación del cliente: van al final, separados.
  const regular = transitions.filter((t) => !skipsClientApproval(status, t));
  const shortcuts = transitions.filter((t) => skipsClientApproval(status, t));
  const pendingSkips = !!pending && skipsClientApproval(status, pending);

  const canRequestApproval =
    !!onRequestApproval && (POST_STATE_TRANSITIONS[status] ?? []).includes("pending_approval");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? <Button size="sm" variant="outline">Cambiar estado</Button>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transitions.length === 0 && !canRequestApproval && (
            <DropdownMenuItem disabled>Sin transiciones disponibles</DropdownMenuItem>
          )}
          {regular.map((t) => (
            <DropdownMenuItem key={t} onClick={() => handleSelect(t)}>
              <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: POST_STATE_META[t].color }} />
              {POST_STATE_META[t].label}
            </DropdownMenuItem>
          ))}
          {canRequestApproval && (
            <DropdownMenuItem onClick={() => onRequestApproval?.()}>
              <span
                className="mr-2 h-2 w-2 rounded-full"
                style={{ backgroundColor: POST_STATE_META.pending_approval.color }}
              />
              {POST_STATE_META.pending_approval.label}…
            </DropdownMenuItem>
          )}
          {shortcuts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1 text-[11px] text-muted-foreground">Sin aprobación del cliente</p>
              {shortcuts.map((t) => (
                <DropdownMenuItem key={t} onClick={() => handleSelect(t)}>
                  <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: POST_STATE_META[t].color }} />
                  {POST_STATE_META[t].label}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Mover a "{pending ? POST_STATE_META[pending].label : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSkips
                ? "Esta publicación no tiene aprobación del cliente. Se marcará igualmente y quedará anotado en el historial; al cliente no se le envía nada."
                : "Esta acción es destructiva. Puedes revertirla más tarde, pero perderás el historial reciente de revisión."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) apply(pending);
                setPending(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
