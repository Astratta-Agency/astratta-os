import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type ExpenseCategory,
} from "@/hooks/useExpenses";

interface Props {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; client_id: string }[];
  category: ExpenseCategory | "all";
  clientId: string;
  projectId: string;
  from: string;
  to: string;
  onChange: (patch: {
    category?: ExpenseCategory | "all";
    clientId?: string;
    projectId?: string;
    from?: string;
    to?: string;
  }) => void;
  onClear: () => void;
}

export function ExpensesFiltersBar({
  clients,
  projects,
  category,
  clientId,
  projectId,
  from,
  to,
  onChange,
  onClear,
}: Props) {
  const hasFilters =
    category !== "all" || !!clientId || !!projectId || !!from || !!to;

  const visibleProjects = clientId
    ? projects.filter((p) => p.client_id === clientId)
    : projects;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={category}
        onValueChange={(v) => onChange({ category: v as ExpenseCategory | "all" })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {EXPENSE_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {EXPENSE_CATEGORY_LABEL[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={clientId || "all"}
        onValueChange={(v) =>
          onChange({ clientId: v === "all" ? "" : v, projectId: "" })
        }
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={projectId || "all"}
        onValueChange={(v) => onChange({ projectId: v === "all" ? "" : v })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Proyecto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los proyectos</SelectItem>
          {visibleProjects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value })}
        className="w-[150px]"
      />
      <span className="text-xs text-muted-foreground">—</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onChange({ to: e.target.value })}
        className="w-[150px]"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" /> Limpiar
        </Button>
      )}
    </div>
  );
}
