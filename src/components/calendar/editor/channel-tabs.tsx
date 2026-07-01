import { useState } from "react";
import { Check, X } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ChannelIcon } from "../channel-icon";
import { CHANNEL_META } from "@/lib/channels";
import { CHANNELS, type Channel } from "@/lib/post-states";
import { cn } from "@/lib/utils";

interface Props {
  channels: Channel[];
  active: Channel | null;
  onActive: (c: Channel) => void;
  onAdd: (c: Channel) => void;
  onRemove: (c: Channel) => void;
}

export function ChannelTabs({ channels, active, onActive, onAdd, onRemove }: Props) {
  const [removing, setRemoving] = useState<Channel | null>(null);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {CHANNELS.map((c) => {
            const meta = CHANNEL_META[c];
            const included = channels.includes(c);
            const isActive = included && active === c;

            return (
              <div key={c} className="group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (!included) {
                          onAdd(c);
                        } else if (!isActive) {
                          onActive(c);
                        }
                      }}
                      aria-label={meta.label}
                      aria-pressed={isActive}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-full text-white transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        !included && "opacity-40 grayscale hover:opacity-70",
                      )}
                      style={{ backgroundColor: included ? meta.color : "hsl(var(--muted))" }}
                    >
                      <ChannelIcon channel={c} size="md" className={cn(!included && "text-muted-foreground")} />
                      {included && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
                          aria-hidden
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{meta.label}</TooltipContent>
                </Tooltip>

                {included && (
                  <button
                    type="button"
                    onClick={() => setRemoving(c)}
                    aria-label={`Eliminar canal ${meta.label}`}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar canal {removing ? CHANNEL_META[removing].label : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la variante específica de este canal. La publicación seguirá existiendo en los otros canales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) onRemove(removing);
                setRemoving(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
