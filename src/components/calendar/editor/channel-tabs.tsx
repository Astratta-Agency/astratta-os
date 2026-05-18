import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChannelIcon } from "../channel-icon";
import { CHANNEL_META, counterTone } from "@/lib/channels";
import { CHANNELS, type Channel } from "@/lib/post-states";
import { cn } from "@/lib/utils";

interface Props {
  channels: Channel[];
  active: Channel | null;
  onActive: (c: Channel) => void;
  onAdd: (c: Channel) => void;
  onRemove: (c: Channel) => void;
  captionLengths: Partial<Record<Channel, number>>;
}

export function ChannelTabs({ channels, active, onActive, onAdd, onRemove, captionLengths }: Props) {
  const [removing, setRemoving] = useState<Channel | null>(null);
  const missing = CHANNELS.filter((c) => !channels.includes(c));

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {channels.map((c) => {
          const meta = CHANNEL_META[c];
          const len = captionLengths[c] ?? 0;
          const tone = counterTone(len, meta.limit);
          const isActive = active === c;
          return (
            <div
              key={c}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <button type="button" onClick={() => onActive(c)} className="flex items-center gap-1.5">
                <ChannelIcon channel={c} size="sm" />
                <span className="font-medium">{meta.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    tone === "ok" && "bg-muted text-muted-foreground",
                    tone === "warn" && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
                    tone === "over" && "bg-destructive/15 text-destructive",
                  )}
                >
                  {len}/{meta.limit}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRemoving(c)}
                aria-label={`Eliminar canal ${meta.label}`}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {missing.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-1 shrink-0">
                <Plus className="mr-1 h-3 w-3" /> Agregar canal
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {missing.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onAdd(c)}>
                  <ChannelIcon channel={c} size="sm" className="mr-2" />
                  {CHANNEL_META[c].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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
