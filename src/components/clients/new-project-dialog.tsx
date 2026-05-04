import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useCreateProject } from "@/hooks/useClientDetail";
import type { ProjectType } from "@/hooks/useClients";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "web_dev", label: "Web Dev" },
  { value: "social_media", label: "Social Media" },
  { value: "paid_ads", label: "Paid Ads" },
  { value: "graphic_design", label: "Diseño" },
  { value: "branding", label: "Branding" },
  { value: "audit", label: "Auditoría" },
];

const schema = z
  .object({
    name: z.string().trim().min(1, "Requerido").max(120),
    type: z.enum(["web_dev", "social_media", "paid_ads", "graphic_design", "branding", "audit"]),
    start_date: z.string().optional().or(z.literal("")),
    end_date: z.string().optional().or(z.literal("")),
    budget_amount: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Debe ser ≥ 0"),
    retainer_monthly: z.boolean().default(false),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || new Date(v.end_date) >= new Date(v.start_date),
    { message: "Fecha de fin debe ser ≥ inicio", path: ["end_date"] },
  );

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  clientId: string | undefined;
}

export function NewProjectDialog({ open, onOpenChange, workspaceId, clientId }: Props) {
  const create = useCreateProject(workspaceId, clientId);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "web_dev",
      start_date: "",
      end_date: "",
      budget_amount: "",
      retainer_monthly: false,
      description: "",
    },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      await create.mutateAsync({
        name: v.name,
        type: v.type as ProjectType,
        start_date: v.start_date || undefined,
        end_date: v.end_date || undefined,
        budget_amount: v.budget_amount ? Number(v.budget_amount) : undefined,
        retainer_monthly: v.retainer_monthly,
        description: v.description || undefined,
      });
      toast({ title: "Proyecto creado", description: v.name });
      form.reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Intenta de nuevo", variant: "destructive" });
    }
  };

  const errs = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>Crea un proyecto vinculado a este cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p_name">Nombre *</Label>
            <Input id="p_name" {...form.register("name")} />
            {errs.name && <p className="text-xs text-destructive">{errs.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as ProjectType, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_start">Inicio</Label>
              <Input id="p_start" type="date" {...form.register("start_date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_end">Deadline</Label>
              <Input id="p_end" type="date" {...form.register("end_date")} />
              {errs.end_date && <p className="text-xs text-destructive">{errs.end_date.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_budget">Presupuesto USD</Label>
              <Input id="p_budget" type="number" min="0" step="0.01" {...form.register("budget_amount")} />
              {errs.budget_amount && (
                <p className="text-xs text-destructive">{errs.budget_amount.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="p_retainer"
                checked={form.watch("retainer_monthly")}
                onCheckedChange={(c) => form.setValue("retainer_monthly", c)}
              />
              <Label htmlFor="p_retainer" className="cursor-pointer">Retainer mensual</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_desc">Descripción</Label>
            <Textarea id="p_desc" rows={3} {...form.register("description")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando…" : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
