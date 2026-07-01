import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { FileSignature, Loader2, Plus, Search, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useUserContext } from "@/hooks/useUserContext";
import { useClients } from "@/hooks/useClients";
import {
  CONTRACT_STATUS_CLASS,
  CONTRACT_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
  useContracts,
  useContractTemplates,
  useContractClauses,
  useCreateContract,
  useUpsertContractTemplate,
  useSetActiveTemplate,
  useDeleteContractTemplate,
  useUpsertContractClause,
  useDeleteContractClause,
  formatVarPrice,
  formatVarDate,
  type ContractStatus,
  type ContractServiceType,
  type ContractRow,
  type ContractTemplateRow,
  type ContractClauseRow,
  type ContractBlock,
} from "@/hooks/useContracts";

const SERVICE_TYPES: ContractServiceType[] = ["web", "social", "ads", "branding", "bundle"];
const STATUSES: ContractStatus[] = [
  "draft",
  "sent",
  "signed_by_client",
  "countersigned",
  "active",
  "expired",
  "renewed",
  "cancelled",
];

export default function Contratos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace } = useActiveWorkspace();
  const { data: ctx } = useUserContext();
  const workspaceId = workspace?.id;
  const membership = ctx?.workspaces?.find((w) => w.workspace_id === workspaceId);
  const isOwner = membership?.role === "owner";

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<ContractServiceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const { data: clients = [] } = useClients(workspaceId, {});
  const { data: contracts = [], isLoading } = useContracts(workspaceId, {
    clientId: clientFilter,
    serviceType: typeFilter,
    status: statusFilter,
    search,
  });

  // Deep-link: ?contract=<id>
  useEffect(() => {
    const cid = searchParams.get("contract");
    if (cid) {
      searchParams.delete("contract");
      setSearchParams(searchParams, { replace: true });
      navigate(`/app/contratos/${cid}`);
    }
  }, [searchParams, setSearchParams, navigate]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileSignature className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="font-display text-3xl font-bold">Contratos</h1>
            <p className="mt-1 text-base text-muted-foreground">
              Generación, firma y repositorio de contratos
            </p>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo contrato
        </Button>
      </header>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Contratos</TabsTrigger>
          {isOwner && <TabsTrigger value="plantillas">Plantillas y cláusulas</TabsTrigger>}
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{PROPOSAL_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : contracts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              No hay contratos que coincidan con los filtros.
            </div>
          ) : (
            <ContractsTable rows={contracts} clients={clients} onOpen={(id) => navigate(`/app/contratos/${id}`)} />
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="plantillas" className="mt-4">
            <TemplatesAndClausesPanel workspaceId={workspaceId} />
          </TabsContent>
        )}
      </Tabs>

      <NewContractDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workspaceId={workspaceId}
        clients={clients}
        onCreated={(id) => navigate(`/app/contratos/${id}`)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContractsTable({
  rows,
  clients,
  onOpen,
}: {
  rows: ContractRow[];
  clients: { id: string; name: string }[];
  onOpen: (id: string) => void;
}) {
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Título</th>
            <th className="px-3 py-2 text-left">Cliente</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-right">Monto</th>
            <th className="px-3 py-2 text-left">Vence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const daysToEnd = r.end_date
              ? differenceInDays(new Date(r.end_date), new Date())
              : null;
            const soon = daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 30;
            return (
              <tr
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2 font-medium">
                  {r.title}
                  {r.version > 1 && (
                    <Badge variant="outline" className="ml-2 text-[10px]">v{r.version}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{clientName(r.client_id)}</td>
                <td className="px-3 py-2 text-muted-foreground">{PROPOSAL_TYPE_LABEL[r.service_type]}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONTRACT_STATUS_CLASS[r.status]}`}>
                    {CONTRACT_STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.currency.toUpperCase()} {formatVarPrice(r.total_amount)}
                </td>
                <td className="px-3 py-2">
                  {r.end_date ? (
                    <span className={soon ? "font-medium text-amber-600" : "text-muted-foreground"}>
                      {formatVarDate(r.end_date)}
                      {soon && <span className="ml-1 text-[10px]">({daysToEnd}d)</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewContractDialog({
  open,
  onOpenChange,
  workspaceId,
  clients,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | undefined;
  clients: { id: string; name: string }[];
  onCreated: (id: string) => void;
}) {
  const { data: templates = [] } = useContractTemplates(workspaceId);
  const create = useCreateContract(workspaceId);
  const { workspace } = useActiveWorkspace();

  const [clientId, setClientId] = useState<string>("");
  const [serviceType, setServiceType] = useState<ContractServiceType>("social");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [alcance, setAlcance] = useState("");

  const activeTemplate = useMemo(
    () => templates.find((t) => t.service_type === serviceType && t.is_active),
    [templates, serviceType],
  );

  useEffect(() => {
    if (!open) {
      setClientId("");
      setTitle("");
      setAmount("");
      setStartDate("");
      setEndDate("");
      setAlcance("");
    }
  }, [open]);

  const handleCreate = async () => {
    if (!clientId) return toast.error("Elegí un cliente");
    if (!title.trim()) return toast.error("Ingresá un título");
    const client = clients.find((c) => c.id === clientId);
    try {
      const row = await create.mutateAsync({
        clientId,
        title: title.trim(),
        serviceType,
        currency,
        totalAmount: Number(amount) || 0,
        startDate: startDate || null,
        endDate: endDate || null,
        templateId: activeTemplate?.id ?? null,
        variables: {
          cliente: client?.name ?? "",
          workspace: workspace?.name ?? "",
          alcance: alcance.trim(),
          precio: formatVarPrice(Number(amount) || 0),
          moneda: currency.toUpperCase(),
          fecha_inicio: formatVarDate(startDate || null),
          fecha_fin: formatVarDate(endDate || null),
        },
      });
      toast.success("Contrato creado");
      onOpenChange(false);
      onCreated(row.id);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo contrato</DialogTitle>
          <DialogDescription>
            El contenido se genera desde la plantilla activa del tipo de servicio elegido.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de servicio</Label>
            <Select value={serviceType} onValueChange={(v) => setServiceType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{PROPOSAL_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!activeTemplate && (
              <p className="mt-1 text-xs text-amber-600">Sin plantilla activa para este tipo. Se creará vacío.</p>
            )}
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrato de servicios..." />
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="ars">ARS</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="mxn">MXN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha inicio</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Fecha fin</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Alcance</Label>
            <Textarea
              value={alcance}
              onChange={(e) => setAlcance(e.target.value)}
              placeholder="Ej: gestión de redes sociales, 12 piezas/mes"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function TemplatesAndClausesPanel({ workspaceId }: { workspaceId: string | undefined }) {
  return (
    <Tabs defaultValue="templates">
      <TabsList>
        <TabsTrigger value="templates">Plantillas</TabsTrigger>
        <TabsTrigger value="clauses">Cláusulas</TabsTrigger>
      </TabsList>
      <TabsContent value="templates" className="mt-4">
        <TemplatesPanel workspaceId={workspaceId} />
      </TabsContent>
      <TabsContent value="clauses" className="mt-4">
        <ClausesPanel workspaceId={workspaceId} />
      </TabsContent>
    </Tabs>
  );
}

function TemplatesPanel({ workspaceId }: { workspaceId: string | undefined }) {
  const { data: templates = [], isLoading } = useContractTemplates(workspaceId);
  const setActive = useSetActiveTemplate(workspaceId);
  const del = useDeleteContractTemplate(workspaceId);
  const [editing, setEditing] = useState<ContractTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ContractTemplateRow | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, ContractTemplateRow[]> = {};
    for (const t of templates) {
      (g[t.service_type] ||= []).push(t);
    }
    return g;
  }, [templates]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva plantilla
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        SERVICE_TYPES.map((type) => (
          <div key={type} className="rounded-lg border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
              {PROPOSAL_TYPE_LABEL[type]}
            </div>
            <ul className="divide-y">
              {(grouped[type] ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {t.is_active && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">v{t.version}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {!t.is_active && (
                      <Button size="sm" variant="outline" onClick={() => setActive.mutate({ id: t.id, service_type: t.service_type })}>
                        Activar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
              {!(grouped[type] ?? []).length && (
                <li className="px-3 py-3 text-sm text-muted-foreground">Sin plantillas</li>
              )}
            </ul>
          </div>
        ))
      )}

      {(editing || creating) && (
        <TemplateEditorDialog
          open
          template={editing}
          workspaceId={workspaceId}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success("Plantilla eliminada");
                } catch (e: any) {
                  toast.error(e?.message ?? "No se pudo eliminar");
                }
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateEditorDialog({
  open,
  template,
  workspaceId,
  onClose,
}: {
  open: boolean;
  template: ContractTemplateRow | null;
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  const upsert = useUpsertContractTemplate(workspaceId);
  const [name, setName] = useState(template?.name ?? "");
  const [serviceType, setServiceType] = useState<ContractServiceType>(template?.service_type ?? "social");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [contentJson, setContentJson] = useState(
    JSON.stringify(template?.content ?? [], null, 2),
  );

  const handleSave = async () => {
    let parsed: ContractBlock[];
    try {
      parsed = JSON.parse(contentJson);
      if (!Array.isArray(parsed)) throw new Error("El contenido debe ser un array");
    } catch (e: any) {
      return toast.error(`JSON inválido: ${e.message}`);
    }
    try {
      await upsert.mutateAsync({
        id: template?.id,
        name: name.trim(),
        service_type: serviceType,
        content: parsed,
        is_active: isActive,
      });
      toast.success(template ? "Plantilla actualizada" : "Plantilla creada");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          <DialogDescription>
            El contenido usa bloques: <code>heading</code>, <code>paragraph</code>, <code>clause</code>. Podés incluir <code>{"{{cliente}}"}</code>, <code>{"{{precio}}"}</code>, etc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={serviceType} onValueChange={(v) => setServiceType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{PROPOSAL_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="mb-0">Activa (una por tipo)</Label>
          </div>
          <div className="md:col-span-2">
            <Label>Contenido (JSON de bloques)</Label>
            <Textarea
              value={contentJson}
              onChange={(e) => setContentJson(e.target.value)}
              className="font-mono text-xs"
              rows={16}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClausesPanel({ workspaceId }: { workspaceId: string | undefined }) {
  const { data: clauses = [], isLoading } = useContractClauses(workspaceId);
  const del = useDeleteContractClause(workspaceId);
  const [editing, setEditing] = useState<ContractClauseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ContractClauseRow | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva cláusula
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="space-y-2">
          {clauses.map((c) => (
            <li key={c.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    {c.category && <Badge variant="outline" className="text-[10px]">{c.category}</Badge>}
                    {!c.is_active && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.body}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(c)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(editing || creating) && (
        <ClauseEditorDialog
          clause={editing}
          workspaceId={workspaceId}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cláusula</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success("Cláusula eliminada");
                } catch (e: any) {
                  toast.error(e?.message ?? "No se pudo eliminar");
                }
                setConfirmDelete(null);
              }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClauseEditorDialog({
  clause,
  workspaceId,
  onClose,
}: {
  clause: ContractClauseRow | null;
  workspaceId: string | undefined;
  onClose: () => void;
}) {
  const upsert = useUpsertContractClause(workspaceId);
  const [title, setTitle] = useState(clause?.title ?? "");
  const [body, setBody] = useState(clause?.body ?? "");
  const [category, setCategory] = useState(clause?.category ?? "");
  const [isActive, setIsActive] = useState(clause?.is_active ?? true);

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Título y cuerpo requeridos");
    try {
      await upsert.mutateAsync({
        id: clause?.id,
        title: title.trim(),
        body: body.trim(),
        category: category.trim() || null,
        is_active: isActive,
      });
      toast.success(clause ? "Cláusula actualizada" : "Cláusula creada");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{clause ? "Editar cláusula" : "Nueva cláusula"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Categoría</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="alcance, pago, confidencialidad..." />
          </div>
          <div>
            <Label>Cuerpo</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="mb-0">Activa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
