import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  blockSubtotal,
  computeTotal,
  defaultContentForType,
  PROPOSAL_TYPE_LABEL,
  useCreateProposal,
  useCreateProposalTemplate,
  useProposalTemplates,
  useUpdateProposal,
  type ProposalBlock,
  type ProposalRow,
  type ProposalType,
} from "@/hooks/useProposals";
import { Badge } from "@/components/ui/badge";
import { ServiceCatalogSelect } from "@/components/settings/service-catalog-select";
import { SERVICE_PRICE_TYPE_LABEL, SERVICE_PRICE_TYPE_SUFFIX } from "@/hooks/useWorkspaceSettings";
import { formatMoney } from "@/lib/money";

type Mode = "create" | "edit";
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  workspaceId: string | undefined;
  leadId: string;
  isOwner: boolean;
  existing?: ProposalRow | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyBlock = (type: ProposalBlock["type"]): ProposalBlock => {
  switch (type) {
    case "text":
      return { type, id: uid(), title: "Sección", body: "" };
    case "services":
      return { type, id: uid(), title: "Servicios", items: [] };
    case "deliverables":
      return { type, id: uid(), title: "Entregables", items: [{ label: "" }] };
    case "timeline":
      return { type, id: uid(), title: "Timeline", items: [{ name: "", when: "" }] };
    case "pricing":
      return {
        type,
        id: uid(),
        title: "Inversión",
        items: [{ name: "", quantity: 1, unit_price: 0 }],
      };
  }
};

const BLOCK_LABEL: Record<ProposalBlock["type"], string> = {
  text: "Texto",
  services: "Servicios",
  deliverables: "Entregables",
  timeline: "Timeline",
  pricing: "Precio",
};

export function ProposalEditor({
  open,
  onOpenChange,
  mode,
  workspaceId,
  leadId,
  isOwner,
  existing,
}: Props) {
  const create = useCreateProposal(workspaceId);
  const update = useUpdateProposal();
  const createTpl = useCreateProposalTemplate(workspaceId);
  const templatesQ = useProposalTemplates(workspaceId);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProposalType>("web");
  const [currency, setCurrency] = useState("usd");
  const [validUntil, setValidUntil] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("blank");
  const [content, setContent] = useState<ProposalBlock[]>([]);
  const [tplDialog, setTplDialog] = useState(false);
  const [tplName, setTplName] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && existing) {
      setTitle(existing.title);
      setType(existing.type);
      setCurrency(existing.currency);
      setValidUntil(existing.valid_until ?? "");
      setContent(existing.content);
      setTemplateId("blank");
    } else {
      setTitle("");
      setType("web");
      setCurrency("usd");
      setValidUntil("");
      setContent(defaultContentForType("web"));
      setTemplateId("blank");
    }
  }, [open, mode, existing?.id]);

  const total = useMemo(() => computeTotal(content), [content]);

  const templates = (templatesQ.data ?? []).filter((t) => t.type === type);

  const handleTypeChange = (t: ProposalType) => {
    setType(t);
    if (mode === "create") {
      setContent(defaultContentForType(t));
      setTemplateId("blank");
    }
  };

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (mode !== "create") return;
    if (id === "blank") {
      setContent(defaultContentForType(type));
    } else {
      const t = templates.find((x) => x.id === id);
      if (t) setContent(t.content as ProposalBlock[]);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= content.length) return;
    const copy = [...content];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    setContent(copy);
  };

  const removeBlock = (idx: number) => setContent(content.filter((_, i) => i !== idx));
  const addBlock = (t: ProposalBlock["type"]) => setContent([...content, emptyBlock(t)]);

  const updateBlock = (idx: number, patch: Partial<ProposalBlock>) => {
    const copy = [...content];
    copy[idx] = { ...copy[idx], ...(patch as any) } as ProposalBlock;
    setContent(copy);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Poné un título");
      return;
    }
    try {
      if (mode === "create") {
        await create.mutateAsync({
          leadId,
          title: title.trim(),
          type,
          currency,
          valid_until: validUntil || null,
          content,
        });
        toast.success("Propuesta creada");
      } else if (existing) {
        await update.mutateAsync({
          id: existing.id,
          leadId: existing.lead_id,
          patch: {
            title: title.trim(),
            content,
            currency,
            valid_until: validUntil || null,
          },
        });
        toast.success("Propuesta actualizada");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!tplName.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    try {
      await createTpl.mutateAsync({ name: tplName.trim(), type, content });
      toast.success("Plantilla guardada");
      setTplDialog(false);
      setTplName("");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nueva propuesta" : "Editar propuesta"}</DialogTitle>
            <DialogDescription>
              Construí la propuesta bloque a bloque. El total se calcula a partir de los bloques de precio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Propuesta comercial — ..." />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => handleTypeChange(v as ProposalType)} disabled={mode === "edit"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROPOSAL_TYPE_LABEL) as ProposalType[]).map((t) => (
                      <SelectItem key={t} value={t}>{PROPOSAL_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === "create" && (
                <div>
                  <Label>Plantilla</Label>
                  <Select value={templateId} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Empezar en blanco</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Válida hasta</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
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
            </div>

            <div className="space-y-3">
              {content.map((b, idx) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  workspaceId={workspaceId}
                  onChange={(p) => updateBlock(idx, p)}
                  onRemove={() => removeBlock(idx)}
                  onUp={() => move(idx, -1)}
                  onDown={() => move(idx, 1)}
                  canUp={idx > 0}
                  canDown={idx < content.length - 1}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
              <span className="text-sm text-muted-foreground">Agregar bloque:</span>
              {(Object.keys(BLOCK_LABEL) as ProposalBlock["type"][]).map((t) => (
                <Button key={t} type="button" variant="outline" size="sm" onClick={() => addBlock(t)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {BLOCK_LABEL[t]}
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">
                {currency.toUpperCase()} {total.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {isOwner && (
              <Button type="button" variant="ghost" onClick={() => setTplDialog(true)}>
                Guardar como plantilla
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tplDialog} onOpenChange={setTplDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como plantilla</DialogTitle>
            <DialogDescription>Guardá el contenido actual como plantilla reutilizable.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nombre</Label>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Ej: Web estándar" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveAsTemplate} disabled={createTpl.isPending}>
              {createTpl.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Block Editor ----------------

function BlockEditor({
  block,
  workspaceId,
  onChange,
  onRemove,
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  block: ProposalBlock;
  workspaceId: string | undefined;
  onChange: (patch: Partial<ProposalBlock>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
          {BLOCK_LABEL[block.type]}
        </span>
        <Input
          className="h-8 flex-1"
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value } as any)}
        />
        <Button type="button" size="icon" variant="ghost" disabled={!canUp} onClick={onUp}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" disabled={!canDown} onClick={onDown}>
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {block.type === "text" && (
        <Textarea
          rows={3}
          value={block.body}
          onChange={(e) => onChange({ body: e.target.value } as any)}
          placeholder="Escribí el contenido de esta sección..."
        />
      )}

      {block.type === "services" && (
        <ServicesFromCatalog
          workspaceId={workspaceId}
          items={block.items}
          onChange={(items) => onChange({ items } as any)}
        />
      )}

      {block.type === "deliverables" && (
        <ItemsList
          items={block.items}
          onChange={(items) => onChange({ items } as any)}
          columns={[{ key: "label", label: "Entregable", placeholder: "Entregable" }]}
          empty={{ label: "" }}
        />
      )}

      {block.type === "timeline" && (
        <ItemsList
          items={block.items}
          onChange={(items) => onChange({ items } as any)}
          columns={[
            { key: "name", label: "Hito", placeholder: "Nombre del hito" },
            { key: "when", label: "Cuándo", placeholder: "Ej: Semana 1-2, 15/03..." },
          ]}
          empty={{ name: "", when: "" }}
        />
      )}

      {block.type === "pricing" && (
        <div className="space-y-2">
          <ItemsList
            items={block.items}
            onChange={(items) => onChange({ items } as any)}
            columns={[
              { key: "name", label: "Concepto", placeholder: "Concepto" },
              { key: "quantity", label: "Cant.", placeholder: "1", type: "number" },
              { key: "unit_price", label: "P. unit.", placeholder: "0", type: "number" },
            ]}
            empty={{ name: "", quantity: 1, unit_price: 0 }}
          />
          <div className="text-right text-sm text-muted-foreground">
            Subtotal:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {blockSubtotal(block).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsList({
  items,
  onChange,
  columns,
  empty,
}: {
  items: Array<Record<string, any>>;
  onChange: (items: Array<Record<string, any>>) => void;
  columns: Array<{ key: string; label: string; placeholder?: string; type?: string }>;
  empty: Record<string, any>;
}) {
  const setItem = (idx: number, key: string, value: any) => {
    const copy = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(copy);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex flex-wrap items-center gap-2">
          {columns.map((c) => (
            <Input
              key={c.key}
              className="h-8 min-w-[120px] flex-1"
              placeholder={c.placeholder}
              type={c.type ?? "text"}
              value={it[c.key] ?? ""}
              onChange={(e) =>
                setItem(idx, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)
              }
            />
          ))}
          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => remove(idx)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { ...empty }])}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Agregar ítem
      </Button>
    </div>
  );
}
