import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  History,
  Instagram,
  KeyRound,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/empty-state";
import { toast } from "@/hooks/use-toast";
import {
  useCanManageCredentials,
  useClientCredentialClientAccess,
  useClientCredentials,
  useCreateCredential,
  useCredentialAccessLog,
  useDeleteCredential,
  useRevealCredential,
  useUpdateCredentialMeta,
  useUpdateCredentialSecret,
  type ClientCredential,
  type CredentialCategory,
} from "@/hooks/useClientCredentials";

const CATEGORY_OPTIONS: { value: CredentialCategory; label: string }[] = [
  { value: "social_media", label: "Redes sociales" },
  { value: "analytics", label: "Analytics" },
  { value: "hosting_domain_cms", label: "Hosting / Dominio / CMS" },
  { value: "tool_other", label: "Otra herramienta" },
];

const CATEGORY_LABEL: Record<CredentialCategory, string> = {
  social_media: "Redes sociales",
  analytics: "Analytics",
  hosting_domain_cms: "Hosting / Dominio / CMS",
  tool_other: "Otra herramienta",
};

function CategoryIcon({ category, className }: { category: CredentialCategory; className?: string }) {
  const cls = className ?? "h-4 w-4";
  switch (category) {
    case "social_media":
      return <Instagram className={cls} />;
    case "analytics":
      return <BarChart3 className={cls} />;
    case "hosting_domain_cms":
      return <Globe className={cls} />;
    case "tool_other":
    default:
      return <KeyRound className={cls} />;
  }
}

interface Props {
  clientId: string;
  workspaceId: string;
}

export function ClientCredentialsTab({ clientId, workspaceId }: Props) {
  const { data: canManage } = useCanManageCredentials(workspaceId);
  const { data: credentials, isLoading } = useClientCredentials(clientId);
  const { data: clientAccessMap } = useClientCredentialClientAccess(clientId, workspaceId);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCredential | null>(null);
  const [deleting, setDeleting] = useState<ClientCredential | null>(null);
  const del = useDeleteCredential(clientId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Credenciales</h3>
          <p className="text-sm text-muted-foreground">
            Bóveda cifrada de accesos del cliente.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Agregar credencial
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (credentials?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aún no hay credenciales guardadas para este cliente"
          description={
            canManage
              ? "Agrega la primera credencial para mantener todos los accesos centralizados y cifrados."
              : "Cuando un miembro con permisos agregue credenciales, aparecerán aquí."
          }
        />
      ) : (
        <div className="space-y-3">
          {credentials!.map((c) => (
            <CredentialRow
              key={c.id}
              credential={c}
              canManage={!!canManage}
              lastClientAccess={clientAccessMap?.[c.id] ?? null}
              onEdit={() => setEditing(c)}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </div>
      )}

      <AccessLogSection clientId={clientId} workspaceId={workspaceId} />

      {canManage && (
        <>
          <CredentialDialog
            mode="create"
            open={addOpen}
            onOpenChange={setAddOpen}
            clientId={clientId}
            workspaceId={workspaceId}
          />
          <CredentialDialog
            mode="edit"
            key={editing?.id ?? "edit"}
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
            clientId={clientId}
            workspaceId={workspaceId}
            credential={editing}
          />
          <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar credencial</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará "{deleting?.label}" y su valor cifrado. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleting) return;
                    try {
                      await del.mutateAsync(deleting.id);
                      toast({ title: "Credencial eliminada" });
                      setDeleting(null);
                    } catch (e: any) {
                      toast({ title: "Error", description: e?.message, variant: "destructive" });
                    }
                  }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function CredentialRow({
  credential,
  canManage,
  lastClientAccess,
  onEdit,
  onDelete,
}: {
  credential: ClientCredential;
  canManage: boolean;
  lastClientAccess?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const reveal = useRevealCredential();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleReveal = async () => {
    try {
      const value = await reveal.mutateAsync(credential.id);
      setRevealed(value);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setRevealed(null), 20_000);
    } catch (e: any) {
      toast({ title: "Error al revelar", description: e?.message, variant: "destructive" });
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      toast({ title: "Copiado al portapapeles" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CategoryIcon category={credential.category} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{credential.label}</span>
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABEL[credential.category]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {credential.username && <span className="truncate">{credential.username}</span>}
              {credential.login_url && (
                <a
                  href={credential.login_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir
                </a>
              )}
            </div>
            {credential.notes && (
              <div className="text-xs text-muted-foreground line-clamp-2">{credential.notes}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm">
            {revealed ? revealed : "••••••••"}
          </div>
          {canManage ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={revealed ? () => setRevealed(null) : handleReveal}
                disabled={reveal.isPending}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {revealed ? "Ocultar" : "Revelar"}
              </Button>
              {revealed && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">Restringido</span>
                </TooltipTrigger>
                <TooltipContent>
                  Solo Owner o Team Member pueden revelar credenciales
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccessLogSection({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useCredentialAccessLog(clientId, workspaceId);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
        >
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Historial de accesos
            <span className="text-xs text-muted-foreground">
              ({data?.length ?? 0})
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay accesos registrados.
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data!.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {entry.actor_name ?? "Miembro del workspace"}
                  </span>{" "}
                  <span className="text-muted-foreground">accedió a</span>{" "}
                  <span className="font-medium text-foreground">{entry.credential_label}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  hace {formatDistanceToNow(new Date(entry.accessed_at), { locale: es })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CredentialDialog({
  mode,
  open,
  onOpenChange,
  clientId,
  workspaceId,
  credential,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  workspaceId: string;
  credential?: ClientCredential | null;
}) {
  const create = useCreateCredential(clientId, workspaceId);
  const updateMeta = useUpdateCredentialMeta(clientId);
  const updateSecret = useUpdateCredentialSecret(clientId);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<CredentialCategory>("social_media");
  const [username, setUsername] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && credential) {
      setLabel(credential.label);
      setCategory(credential.category);
      setUsername(credential.username ?? "");
      setLoginUrl(credential.login_url ?? "");
      setNotes(credential.notes ?? "");
      setSecret("");
      setShowSecret(false);
    } else {
      setLabel("");
      setCategory("social_media");
      setUsername("");
      setLoginUrl("");
      setNotes("");
      setSecret("");
      setShowSecret(false);
    }
  }, [open, mode, credential]);

  const pending = create.isPending || updateMeta.isPending || updateSecret.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast({ title: "El label es requerido", variant: "destructive" });
      return;
    }
    try {
      if (mode === "create") {
        if (!secret.trim()) {
          toast({ title: "El valor secreto es requerido", variant: "destructive" });
          return;
        }
        await create.mutateAsync({
          label: label.trim(),
          category,
          secret,
          username: username.trim() || null,
          login_url: loginUrl.trim() || null,
          notes: notes.trim() || null,
        });
        toast({ title: "Credencial guardada" });
      } else if (credential) {
        await updateMeta.mutateAsync({
          id: credential.id,
          label: label.trim(),
          category,
          username: username.trim() || null,
          login_url: loginUrl.trim() || null,
          notes: notes.trim() || null,
        });
        if (secret.trim()) {
          await updateSecret.mutateAsync({ id: credential.id, secret });
        }
        toast({ title: "Credencial actualizada" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Agregar credencial" : "Editar credencial"}
          </DialogTitle>
          <DialogDescription>
            El valor se almacena cifrado en la bóveda. Solo se descifra al revelarlo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cred_label">Label *</Label>
            <Input
              id="cred_label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Instagram @cliente"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoría *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CredentialCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cred_user">Usuario</Label>
              <Input
                id="cred_user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario o email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cred_url">URL de acceso</Label>
              <Input
                id="cred_url"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred_secret">
              {mode === "create" ? "Valor secreto *" : "Nuevo valor secreto"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="cred_secret"
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={
                  mode === "edit" ? "Dejar en blanco para no cambiar" : "Contraseña, token, API key…"
                }
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred_notes">Notas</Label>
            <Textarea
              id="cred_notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="2FA, recovery codes, contexto…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Guardar credencial" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
