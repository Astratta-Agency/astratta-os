import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeleteRecurrenceRule,
  useRecurrenceRules,
  useUpdateRecurrenceRule,
  type RecurrenceRule,
} from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { RecurringRuleDialog } from "./recurring-rule-dialog";

const FREQ_LABEL = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
};

interface Props {
  workspaceId: string;
  members: WorkspaceMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}

export function RecurringRulesTab({ workspaceId, members, clients, projects }: Props) {
  const { data: rules = [], isLoading } = useRecurrenceRules(workspaceId);
  const update = useUpdateRecurrenceRule();
  const del = useDeleteRecurrenceRule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurrenceRule | null>(null);

  const memberName = (id: string | null) => {
    if (!id) return "—";
    const m = members.find((x) => x.user_id === id);
    return m?.full_name || m?.email || id.slice(0, 6);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Las reglas se procesan cada mañana y generan las tareas automáticamente. Las tareas de
          onboarding de nuevos clientes se crean solas al firmarse una propuesta.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva regla
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">Aún no hay reglas recurrentes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea una regla para automatizar tareas repetitivas.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead className="w-[110px]">Frecuencia</TableHead>
                <TableHead className="w-[150px]">Próxima fecha</TableHead>
                <TableHead className="w-[180px]">Asignado</TableHead>
                <TableHead className="w-[100px]">Activa</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditing(r);
                    setDialogOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm">{FREQ_LABEL[r.frequency]}</TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(r.next_run_date), "dd MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">{memberName(r.assigned_to)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) =>
                        update.mutate({ id: r.id, patch: { is_active: v } })
                      }
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm("¿Eliminar regla?")) return;
                        try {
                          await del.mutateAsync(r.id);
                          toast.success("Regla eliminada");
                        } catch (e: any) {
                          toast.error("No se pudo eliminar", { description: e?.message });
                        }
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
      )}

      <RecurringRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={workspaceId}
        members={members}
        clients={clients}
        projects={projects}
        editing={editing}
      />
    </div>
  );
}
