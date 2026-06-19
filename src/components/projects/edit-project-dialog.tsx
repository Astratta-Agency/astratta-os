import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPES,
  PROJECT_TYPE_LABEL,
} from "@/components/projects/project-meta";
import { useUpdateProject } from "@/hooks/useProjects";
import type {
  ProjectStatus,
  ProjectType,
} from "@/integrations/supabase/database.types";

const PROJECT_TYPE_VALUES = [
  "web_dev",
  "social_media",
  "paid_ads",
  "graphic_design",
  "branding",
  "audit",
] as const;
const PROJECT_STATUS_VALUES = [
  "planning",
  "in_progress",
  "paused",
  "delivered",
  "closed",
] as const;

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(120, "Máximo 120 caracteres"),
    type: z.enum(PROJECT_TYPE_VALUES),
    status: z.enum(PROJECT_STATUS_VALUES),
    client_id: z.string().uuid("Selecciona un cliente"),
    start_date: z.date().optional().nullable(),
    end_date: z.date().optional().nullable(),
    budget_amount: z
      .number({ invalid_type_error: "Número inválido" })
      .min(0, "No puede ser negativo")
      .nullable()
      .optional(),
    progress: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .optional(),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    { path: ["end_date"], message: "Debe ser ≥ fecha de inicio" },
  );

type FormValues = z.infer<typeof schema>;

type ProjectShape = {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  progress?: number | null;
};

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectShape;
  clients: ClientOption[];
}

const toDate = (s: string | null) => (s ? parseISO(s) : null);
const toIso = (d: Date | null | undefined) =>
  d ? format(d, "yyyy-MM-dd") : null;

export function EditProjectDialog({ open, onOpenChange, project, clients }: Props) {
  const update = useUpdateProject();
  const [clientCbOpen, setClientCbOpen] = useState(false);

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: project.name,
      type: project.type,
      status: project.status,
      client_id: project.client_id,
      start_date: toDate(project.start_date),
      end_date: toDate(project.end_date),
      budget_amount: project.budget_amount,
      progress: project.progress ?? null,
    }),
    [project],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const onSubmit = async (values: FormValues) => {
    const patch = {
      name: values.name.trim(),
      type: values.type,
      status: values.status,
      client_id: values.client_id,
      start_date: toIso(values.start_date ?? null),
      end_date: toIso(values.end_date ?? null),
      budget_amount: values.budget_amount ?? null,
      progress: values.progress ?? null,
    };
    const statusChanged = values.status !== project.status;

    const fmtDate = (s: string | null) => (s ? s : "—");
    const fmtMoney = (n: number | null) =>
      n == null ? "—" : `$${n.toLocaleString("es-MX")}`;
    const fmtProgress = (n: number | null | undefined) =>
      n == null ? "—" : `${n}%`;
    const clientName = (id: string) =>
      clients.find((c) => c.id === id)?.name ?? id;

    const changes: { field: string; from: string; to: string }[] = [];
    if (patch.name !== project.name)
      changes.push({ field: "Nombre", from: project.name, to: patch.name });
    if (patch.type !== project.type)
      changes.push({
        field: "Tipo",
        from: PROJECT_TYPE_LABEL[project.type],
        to: PROJECT_TYPE_LABEL[patch.type],
      });
    if (patch.client_id !== project.client_id)
      changes.push({
        field: "Cliente",
        from: clientName(project.client_id),
        to: clientName(patch.client_id),
      });
    if (patch.start_date !== project.start_date)
      changes.push({
        field: "Fecha de inicio",
        from: fmtDate(project.start_date),
        to: fmtDate(patch.start_date),
      });
    if (patch.end_date !== project.end_date)
      changes.push({
        field: "Deadline",
        from: fmtDate(project.end_date),
        to: fmtDate(patch.end_date),
      });
    if ((patch.budget_amount ?? null) !== (project.budget_amount ?? null))
      changes.push({
        field: "Presupuesto",
        from: fmtMoney(project.budget_amount),
        to: fmtMoney(patch.budget_amount),
      });
    if ((patch.progress ?? null) !== (project.progress ?? null))
      changes.push({
        field: "Progreso",
        from: fmtProgress(project.progress),
        to: fmtProgress(patch.progress),
      });

    try {
      await update.mutateAsync({
        projectId: project.id,
        patch,
        statusChange: statusChanged
          ? {
              fromStatus: project.status,
              toStatus: values.status,
              workspaceId: project.workspace_id,
              clientId: values.client_id,
              projectName: patch.name,
            }
          : undefined,
        fieldChanges: changes.length
          ? {
              workspaceId: project.workspace_id,
              clientId: values.client_id,
              projectName: patch.name,
              changes,
            }
          : undefined,
      });
      toast.success("Proyecto actualizado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo actualizar", { description: e?.message });
    }
  };

  const selectedClient = clients.find((c) => c.id === form.watch("client_id"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del proyecto *</FormLabel>
                  <FormControl>
                    <Input maxLength={120} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {PROJECT_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PROJECT_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Popover open={clientCbOpen} onOpenChange={setClientCbOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          {selectedClient?.name ?? "Selecciona un cliente"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados</CommandEmpty>
                          <CommandGroup>
                            {clients.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  field.onChange(c.id);
                                  setClientCbOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de inicio</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start font-normal"
                          >
                            {field.value
                              ? format(field.value, "PPP")
                              : "Selecciona fecha"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(d) => field.onChange(d ?? null)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start font-normal"
                          >
                            {field.value
                              ? format(field.value, "PPP")
                              : "Selecciona fecha"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(d) => field.onChange(d ?? null)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="budget_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="pl-7"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => {
                const val = field.value ?? 0;
                return (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Progreso</FormLabel>
                      <span className="text-sm font-medium text-muted-foreground">
                        {val}%
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[val]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(v) => field.onChange(v[0])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={update.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
