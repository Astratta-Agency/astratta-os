import { format } from "date-fns";
import { Check, Minus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { useDeleteExpense, type ExpenseRow } from "@/hooks/useExpenses";
import { ExpenseCategoryBadge } from "./expense-category-badge";

interface Props {
  expenses: ExpenseRow[];
  loading?: boolean;
}

export function ExpensesTable({ expenses, loading }: Props) {
  const del = useDeleteExpense();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (!expenses.length) {
    return (
      <EmptyState
        title="Aún no hay gastos registrados"
        description="Los gastos operativos y costos de proyecto aparecerán aquí."
        icon={<Receipt className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Proyecto / Cliente</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-center">Facturable</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {format(new Date(e.expense_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <ExpenseCategoryBadge category={e.category} />
              </TableCell>
              <TableCell className="max-w-[280px] truncate">{e.description}</TableCell>
              <TableCell className="text-muted-foreground">{e.vendor ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {e.project?.name ?? e.client?.name ?? "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(e.amount, e.currency)}
              </TableCell>
              <TableCell className="text-center">
                {e.is_billable ? (
                  <Check className="mx-auto h-4 w-4 text-emerald-500" />
                ) : (
                  <Minus className="mx-auto h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (!confirm(`¿Eliminar gasto "${e.description}"?`)) return;
                    del.mutate(e.id, {
                      onSuccess: () => toast.success("Gasto eliminado"),
                      onError: (err: any) =>
                        toast.error(err?.message ?? "Error al eliminar"),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
