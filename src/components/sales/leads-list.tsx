import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
  type LeadRow,
  type LeadStage,
} from "@/hooks/useSales";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type SortKey = "company_name" | "stage" | "estimated_value" | "probability" | "expected_close_date";

export function LeadsList({
  leads,
  onOpen,
}: {
  leads: LeadRow[];
  onOpen: (lead: LeadRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("company_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let rows = leads.filter((l) => {
      if (stage !== "all" && l.stage !== stage) return false;
      if (!s) return true;
      return (
        l.company_name.toLowerCase().includes(s) ||
        l.contact_name.toLowerCase().includes(s) ||
        l.contact_email.toLowerCase().includes(s)
      );
    });
    rows = [...rows].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [leads, search, stage, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar empresa, contacto o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={stage} onValueChange={(v) => setStage(v as any)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {LEAD_STAGE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company_name")}>
                Empresa
              </TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("stage")}>
                Etapa
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("estimated_value")}>
                Valor
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("probability")}>
                Prob.
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("expected_close_date")}>
                Cierre esperado
              </TableHead>
              <TableHead>Fuente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  Sin leads que coincidan.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => onOpen(l)}
              >
                <TableCell className="font-medium">{l.company_name}</TableCell>
                <TableCell>
                  <div className="text-sm">{l.contact_name}</div>
                  <div className="text-xs text-muted-foreground">{l.contact_email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{LEAD_STAGE_LABEL[l.stage]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {l.estimated_value != null ? usd.format(Number(l.estimated_value)) : "—"}
                </TableCell>
                <TableCell className="text-right">{l.probability}%</TableCell>
                <TableCell>
                  {l.expected_close_date
                    ? format(new Date(l.expected_close_date), "d MMM yyyy", { locale: es })
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {LEAD_SOURCE_LABEL[l.source]}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
