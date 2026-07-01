import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Ban,
  Copy,
  Eye,
  FileSignature,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
  MoveUp,
  MoveDown,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  CONTRACT_STATUS_CLASS,
  CONTRACT_STATUS_LABEL,
  PROPOSAL_TYPE_LABEL,
  useContract,
  useContractClauses,
  useContractSignatures,
  useContractEvents,
  useUpdateContract,
  useSendContract,
  useCountersignContract,
  useCancelContract,
  useRenewContract,
  useCreateContract,
  formatVarPrice,
  type ContractBlock,
  type ContractRow,
} from "@/hooks/useContracts";

import { SignaturePad, type SignaturePadHandle } from "@/components/sales/proposals/signature-pad";
import { supabase } from "@/integrations/supabase/client";

export default function ContratoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(id);
  const { data: signatures = [] } = useContractSignatures(id);
  const { data: events = [] } = useContractEvents(id);

  const [clientName, setClientName] = useState<string>("—");
  useEffect(() => {
    let mounted = true;
    if (!contract?.client_id) return;
    (supabase as any)
      .from("clients")
      .select("name")
      .eq("id", contract.client_id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (mounted && data) setClientName(data.name);
      });
    return () => { mounted = false; };
  }, [contract?.client_id]);

  const [countersignOpen, setCountersignOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading || !contract) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const clientSig = signatures.find((s) => s.signer_role === "client") ?? null;
  const agencySig = signatures.find((s) => s.signer_role === "agency") ?? null;
  const isDraft = contract.status === "draft";
  const publicUrl = `${window.location.origin}/contratos/${contract.public_token}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/contratos")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Contratos
          </Button>
          <FileSignature className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="font-display text-2xl font-bold">{contract.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{clientName}</span>
              <span>·</span>
              <span>{PROPOSAL_TYPE_LABEL[contract.service_type]}</span>
              <span>·</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONTRACT_STATUS_CLASS[contract.status]}`}>
                {CONTRACT_STATUS_LABEL[contract.status]}
              </span>
              <span>·</span>
              <span>v{contract.version}</span>
            </div>
          </div>
        </div>
        <ContractActions
          contract={contract}
          hasClientSig={!!clientSig}
          publicUrl={publicUrl}
          onCountersign={() => setCountersignOpen(true)}
          onCancel={() => setConfirmCancel(true)}
          onRenewed={(newId) => navigate(`/app/contratos/${newId}`)}
        />
      </div>

      <ContractMetaBar contract={contract} publicUrl={publicUrl} />

      <ContractContentEditor contract={contract} editable={isDraft} />

      {signatures.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clientSig && <SignatureCard title="Firma del cliente" sig={clientSig} />}
          {agencySig && <SignatureCard title="Firma de la agencia" sig={agencySig} />}
        </div>
      )}

      {events.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">Auditoría</div>
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="capitalize">{e.event_type}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(e.occurred_at), "d MMM yyyy HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CountersignDialog
        open={countersignOpen}
        contractId={contract.id}
        onOpenChange={setCountersignOpen}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marca el contrato como cancelado. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CancelContractFooter
            id={contract.id}
            onDone={() => setConfirmCancel(false)}
          />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CancelContractFooter({ id, onDone }: { id: string; onDone: () => void }) {
  const cancel = useCancelContract();
  return (
    <AlertDialogFooter>
      <AlertDialogCancel>Volver</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={async () => {
          try {
            await cancel.mutateAsync(id);
            toast.success("Contrato cancelado");
            onDone();
          } catch (e: any) {
            toast.error(e?.message ?? "No se pudo cancelar");
          }
        }}
      >
        Cancelar contrato
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

function ContractActions({
  contract,
  hasClientSig,
  publicUrl,
  onCountersign,
  onCancel,
  onRenewed,
}: {
  contract: ContractRow;
  hasClientSig: boolean;
  publicUrl: string;
  onCountersign: () => void;
  onCancel: () => void;
  onRenewed: (id: string) => void;
}) {
  const send = useSendContract();
  const renew = useRenewContract();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const canCancel = ["draft", "sent", "active", "countersigned"].includes(contract.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(contract.status === "sent" || contract.status === "signed_by_client" || contract.status === "countersigned" || contract.status === "active") && (
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
        </Button>
      )}
      {contract.status === "draft" && (
        <Button size="sm" onClick={async () => {
          try { await send.mutateAsync(contract.id); toast.success("Contrato enviado"); }
          catch (e: any) { toast.error(e?.message ?? "No se pudo enviar"); }
        }}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
        </Button>
      )}
      {contract.status === "signed_by_client" && (
        <Button size="sm" onClick={onCountersign}>
          <FileSignature className="mr-1.5 h-3.5 w-3.5" /> Contrafirmar
        </Button>
      )}
      {contract.status === "expired" && (
        <Button size="sm" onClick={async () => {
          try {
            const r = await renew.mutateAsync(contract.id);
            toast.success("Nueva versión creada");
            onRenewed(r.id);
          } catch (e: any) { toast.error(e?.message ?? "No se pudo renovar"); }
        }}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Renovar
        </Button>
      )}
      {canCancel && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={onCancel}>
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancelar
        </Button>
      )}
    </div>
  );
}

function ContractMetaBar({ contract, publicUrl }: { contract: ContractRow; publicUrl: string }) {
  const upd = useUpdateContract();
  const isDraft = contract.status === "draft";
  const [start, setStart] = useState(contract.start_date ?? "");
  const [end, setEnd] = useState(contract.end_date ?? "");
  const [amount, setAmount] = useState(String(contract.total_amount ?? 0));
  const [currency, setCurrency] = useState(contract.currency);

  const saveMeta = async (patch: any) => {
    try {
      await upd.mutateAsync({ id: contract.id, patch });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
      <div>
        <Label className="text-xs">Inicio</Label>
        {isDraft ? (
          <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); saveMeta({ start_date: e.target.value || null }); }} />
        ) : (
          <div className="text-sm">{contract.start_date ? format(new Date(contract.start_date), "d MMM yyyy") : "—"}</div>
        )}
      </div>
      <div>
        <Label className="text-xs">Fin</Label>
        {isDraft ? (
          <Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); saveMeta({ end_date: e.target.value || null }); }} />
        ) : (
          <div className="text-sm">{contract.end_date ? format(new Date(contract.end_date), "d MMM yyyy") : "—"}</div>
        )}
      </div>
      <div>
        <Label className="text-xs">Monto</Label>
        {isDraft ? (
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => saveMeta({ total_amount: Number(amount) || 0 })} />
        ) : (
          <div className="text-sm font-medium">{contract.currency.toUpperCase()} {formatVarPrice(contract.total_amount)}</div>
        )}
      </div>
      <div>
        <Label className="text-xs">Moneda</Label>
        {isDraft ? (
          <Select value={currency} onValueChange={(v) => { setCurrency(v); saveMeta({ currency: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="ars">ARS</SelectItem>
              <SelectItem value="eur">EUR</SelectItem>
              <SelectItem value="mxn">MXN</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm">{contract.currency.toUpperCase()}</div>
        )}
      </div>
      {(contract.status === "sent" || contract.status === "signed_by_client") && (
        <div className="md:col-span-4 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground">Link público:</span>
          <code className="flex-1 truncate">{publicUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContractContentEditor({
  contract,
  editable,
}: {
  contract: ContractRow;
  editable: boolean;
}) {
  const upd = useUpdateContract();
  const [blocks, setBlocks] = useState<ContractBlock[]>(contract.content);
  const [clausePickerOpen, setClausePickerOpen] = useState(false);

  useEffect(() => setBlocks(contract.content), [contract.id]);

  const persist = (next: ContractBlock[]) => {
    setBlocks(next);
    upd.mutate({ id: contract.id, patch: { content: next } });
  };

  const updateBlock = (i: number, patch: Partial<ContractBlock>) => {
    const next = blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    persist(next);
  };
  const removeBlock = (i: number) => persist(blocks.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  };
  const addBlock = (type: ContractBlock["type"]) => {
    persist([...blocks, { type, title: type === "clause" ? "Cláusula" : type === "heading" ? "Título" : undefined, text: "" }]);
  };

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => addBlock("heading")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Título
          </Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("paragraph")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Párrafo
          </Button>
          <Button size="sm" variant="outline" onClick={() => addBlock("clause")}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Cláusula
          </Button>
          <Button size="sm" variant="outline" onClick={() => setClausePickerOpen(true)}>
            <BookOpen className="mr-1 h-3.5 w-3.5" /> Insertar de librería
          </Button>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Contrato sin contenido.
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <div key={i} className="rounded-lg border p-4">
              {editable ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {b.type}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => moveBlock(i, -1)}><MoveUp className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => moveBlock(i, 1)}><MoveDown className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeBlock(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(b.type === "heading" || b.type === "clause") && (
                    <Input
                      value={b.title ?? ""}
                      onChange={(e) => updateBlock(i, { title: e.target.value })}
                      placeholder="Título"
                    />
                  )}
                  <Textarea
                    value={b.text}
                    onChange={(e) => updateBlock(i, { text: e.target.value })}
                    rows={b.type === "heading" ? 1 : 5}
                    placeholder="Texto del bloque..."
                  />
                </div>
              ) : (
                <ReadOnlyBlock block={b} />
              )}
            </div>
          ))}
        </div>
      )}

      <ClausePickerDialog
        open={clausePickerOpen}
        onClose={() => setClausePickerOpen(false)}
        workspaceId={contract.workspace_id}
        onPick={(clause) => {
          persist([...blocks, { type: "clause", title: clause.title, text: clause.body }]);
          setClausePickerOpen(false);
        }}
      />
    </div>
  );
}

function ReadOnlyBlock({ block }: { block: ContractBlock }) {
  if (block.type === "heading") {
    return <h2 className="text-xl font-semibold">{block.title || block.text}</h2>;
  }
  if (block.type === "clause") {
    return (
      <div>
        {block.title && <h3 className="mb-1 font-semibold">{block.title}</h3>}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{block.text}</p>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{block.text}</p>;
}

function ClausePickerDialog({
  open,
  onClose,
  workspaceId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onPick: (c: { title: string; body: string }) => void;
}) {
  const { data: clauses = [] } = useContractClauses(workspaceId);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Insertar cláusula de la librería</DialogTitle>
        </DialogHeader>
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {clauses.filter((c) => c.is_active).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick({ title: c.title, body: c.body })}
                className="w-full rounded-lg border p-3 text-left hover:bg-muted/50"
              >
                <div className="font-medium">{c.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.body}</p>
              </button>
            </li>
          ))}
          {!clauses.length && (
            <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sin cláusulas en la librería.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function CountersignDialog({
  open,
  contractId,
  onOpenChange,
}: {
  open: boolean;
  contractId: string;
  onOpenChange: (v: boolean) => void;
}) {
  const countersign = useCountersignContract();
  const padRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState("");
  const [sig, setSig] = useState("");
  const [empty, setEmpty] = useState(true);

  useEffect(() => { if (!open) { setName(""); setSig(""); setEmpty(true); } }, [open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Ingresá tu nombre");
    if (empty || !sig) return toast.error("Dibujá tu firma");
    try {
      await countersign.mutateAsync({
        contractId,
        signerName: name.trim(),
        signatureDataUrl: sig,
      });
      toast.success("Contrato contrafirmado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo contrafirmar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contrafirmar contrato</DialogTitle>
          <DialogDescription>
            Al contrafirmar se activa el onboarding automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre de quien contrafirma</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Firma</Label>
            <SignaturePad
              ref={padRef}
              onChange={(url, isEmpty) => { setSig(url); setEmpty(isEmpty); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={countersign.isPending}>
            {countersign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Contrafirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignatureCard({ title, sig }: { title: string; sig: any }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <img
        src={sig.signature_data_url}
        alt={`Firma de ${sig.signer_name}`}
        className="mb-2 h-24 w-full rounded border bg-white object-contain"
      />
      <div className="text-sm font-medium">{sig.signer_name}</div>
      <div className="text-xs text-muted-foreground">
        {format(new Date(sig.signed_at), "d MMM yyyy 'a las' HH:mm")}
      </div>
    </div>
  );
}
