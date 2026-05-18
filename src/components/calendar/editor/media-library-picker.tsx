import { useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldAlert, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaAssets, type MediaAssetRow } from "@/hooks/useMediaAssets";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  isHealthcare: boolean;
  /** Currently attached URLs — used to mark already-selected items. */
  attachedUrls: string[];
  onAdd: (urls: string[]) => void;
  /** When true, dialog opens on the "Pendientes de consentimiento" tab. */
  initialPendingOnly?: boolean;
}

export function MediaLibraryPicker({
  open,
  onOpenChange,
  clientId,
  isHealthcare,
  attachedUrls,
  onAdd,
  initialPendingOnly,
}: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "pending">(
    initialPendingOnly ? "pending" : "all",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: assets = [], isLoading } = useMediaAssets(clientId, {
    search,
    pendingConsentOnly: tab === "pending",
  });

  const attached = useMemo(() => new Set(attachedUrls), [attachedUrls]);

  const toggle = (a: MediaAssetRow) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(a.public_url)) n.delete(a.public_url);
      else n.add(a.public_url);
      return n;
    });
  };

  const add = () => {
    const toAdd = Array.from(selected).filter((u) => !attached.has(u));
    if (toAdd.length) onAdd(toAdd);
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Biblioteca de medios</DialogTitle>
          <DialogDescription>
            Reutiliza imágenes y videos ya subidos para este cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre"
              className="pl-7"
            />
          </div>
          {isHealthcare && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pending">Pendientes</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        <ScrollArea className="h-[420px] rounded-md border">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : assets.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {tab === "pending"
                ? "No hay assets pendientes de consentimiento."
                : "Aún no hay medios. Sube uno desde el editor."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((a) => {
                const isSel = selected.has(a.public_url);
                const isAttached = attached.has(a.public_url);
                const isVideo = a.mime_type.startsWith("video/");
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => !isAttached && toggle(a)}
                    disabled={isAttached}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-md border bg-muted text-left transition",
                      isSel && "ring-2 ring-primary",
                      isAttached && "opacity-50",
                    )}
                  >
                    {isVideo ? (
                      <video src={a.public_url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img
                        src={a.public_url}
                        alt={a.file_name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {isSel && (
                      <div className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {isAttached && (
                      <div className="absolute inset-x-0 bottom-0 bg-background/80 px-1 py-0.5 text-center text-[10px] backdrop-blur">
                        Ya agregado
                      </div>
                    )}
                    {a.consent_required && (
                      <div className="absolute left-1 top-1">
                        {a.consent_signed ? (
                          <Badge
                            variant="outline"
                            className="gap-0.5 border-green-500/60 bg-green-500/10 px-1 py-0 text-[9px] text-green-700 dark:text-green-300"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" />
                            OK
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-0.5 border-destructive/60 bg-destructive/10 px-1 py-0 text-[9px] text-destructive"
                          >
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Falta
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 px-1 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {a.file_name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={add} disabled={selected.size === 0}>
            Agregar {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
