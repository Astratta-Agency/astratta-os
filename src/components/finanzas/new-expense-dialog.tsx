import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  useCreateExpense,
  type ExpenseCategory,
} from "@/hooks/useExpenses";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
}

export function NewExpenseDialog({ open, onOpenChange, workspaceId }: Props) {
  const { data: clients = [] } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const { data: projects = [] } = useProjects(workspaceId, {});
  const create = useCreateExpense();

  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vendor, setVendor] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isBillable, setIsBillable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory("other");
    setDescription("");
    setAmount("");
    setExpenseDate(format(new Date(), "yyyy-MM-dd"));
    setVendor("");
    setClientId("");
    setProjectId("");
    setIsBillable(false);
  }, [open]);

  const availableProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.client_id === clientId) : projects),
    [clientId, projects],
  );

  // If project is selected, auto-derive client
  useEffect(() => {
    if (!projectId) return;
    const p = projects.find((x) => x.id === projectId);
    if (p && p.client_id !== clientId) setClientId(p.client_id);
  }, [projectId, projects, clientId]);

  const canSave =
    !!workspaceId && description.trim().length > 0 && Number(amount) > 0;

  const handleSave = () => {
    if (!workspaceId || !canSave) return;
    create.mutate(
      {
        workspaceId,
        category,
        description: description.trim(),
        amount: Number(amount),
        expenseDate,
        vendor: vendor.trim() || null,
        clientId: clientId || null,
        projectId: projectId || null,
        isBillable,
      },
      {
        onSuccess: () => {
          toast.success("Gasto registrado");
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err?.message ?? "Error al guardar"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo gasto</DialogTitle>
          <DialogDescription>
            Registra un costo operativo o de proyecto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Categoría</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXPENSE_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Fecha</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej. Meta Ads — campaña octubre"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Monto (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Proveedor (opcional)</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Ej. Meta, Figma"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Cliente (opcional)</Label>
              <Select
                value={clientId || "none"}
                onValueChange={(v) => {
                  setClientId(v === "none" ? "" : v);
                  setProjectId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Proyecto (opcional)</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {availableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isBillable}
              onCheckedChange={(v) => setIsBillable(v === true)}
            />
            Facturable al cliente
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || create.isPending}>
            {create.isPending ? "Guardando..." : "Guardar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
