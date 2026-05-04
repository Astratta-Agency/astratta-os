import { useState } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ServicesChips } from "@/components/clients/services-chips";
import { NewProjectDialog } from "@/components/clients/new-project-dialog";
import type { ClientProject } from "@/hooks/useClientDetail";
import { toast } from "@/hooks/use-toast";

const statusLabel: Record<string, { label: string; className: string }> = {
  planning: { label: "Planificación", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  in_progress: { label: "En progreso", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  paused: { label: "Pausado", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  delivered: { label: "Entregado", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  closed: { label: "Cerrado", className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30" },
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface Props {
  workspaceId: string;
  clientId: string;
  projects: ClientProject[];
}

export function ClientProjectsTab({ workspaceId, clientId, projects }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Proyectos</h3>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aún no hay proyectos. Crea el primero para empezar a trackear entregas.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Presupuesto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const s = statusLabel[p.status] ?? { label: p.status, className: "" };
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => toast({ title: "Detalle de proyecto próximamente" })}
                  >
                    <TableCell className="font-medium">
                      {p.name}
                      {p.retainer_monthly && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Retainer</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <ServicesChips projects={[{ type: p.type }]} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.className}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.start_date ? format(new Date(p.start_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.end_date ? format(new Date(p.end_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {p.budget_amount != null ? usd.format(Number(p.budget_amount)) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <NewProjectDialog
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        clientId={clientId}
      />
    </div>
  );
}
