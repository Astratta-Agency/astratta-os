import { Badge } from "@/components/ui/badge";
import { EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/hooks/useExpenses";

const CLS: Record<ExpenseCategory, string> = {
  ads_spend: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  software: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  contractor: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  other: "border-muted bg-muted text-muted-foreground",
};

export function ExpenseCategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <Badge variant="outline" className={CLS[category]}>
      {EXPENSE_CATEGORY_LABEL[category]}
    </Badge>
  );
}
