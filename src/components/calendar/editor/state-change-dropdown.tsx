import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { POST_STATE_META, POST_STATE_TRANSITIONS, type PostStatus } from "@/lib/post-states";

interface Props {
  status: PostStatus;
  onChange: (to: PostStatus) => void;
  trigger?: React.ReactNode;
}

const DESTRUCTIVE: PostStatus[] = ["archived", "rejected"];

export function StateChangeDropdown({ status, onChange, trigger }: Props) {
  const [pending, setPending] = useState<PostStatus | null>(null);
  const transitions = POST_STATE_TRANSITIONS[status] ?? [];

  const handleSelect = (to: PostStatus) => {
    if (DESTRUCTIVE.includes(to)) {
      setPending(to);
      return;
    }
    apply(to);
  };

  const apply = (to: PostStatus) => {
    onChange(to);
    if (to === "pending_approval") {
      toast("Estado actualizado", {
        description: "El envío de aprobación por email llegará en la Fase 4.4",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? <Button size="sm" variant="outline">Cambiar estado</Button>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transitions.length === 0 && (
            <DropdownMenuItem disabled>Sin transiciones disponibles</DropdownMenuItem>
          )}
          {transitions.map((t) => (
            <DropdownMenuItem key={t} onClick={() => handleSelect(t)}>
              <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: POST_STATE_META[t].color }} />
              {POST_STATE_META[t].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Mover a "{pending ? POST_STATE_META[pending].label : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es destructiva. Puedes revertirla más tarde, pero perderás el historial reciente de revisión.
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
