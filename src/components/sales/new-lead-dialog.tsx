import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LEAD_SOURCE_LABEL,
  useCreateLead,
  type LeadSource,
} from "@/hooks/useSales";

const schema = z.object({
  company_name: z.string().trim().min(1, "Requerido").max(255),
  contact_name: z.string().trim().min(1, "Requerido").max(255),
  contact_email: z.string().email("Correo inválido").max(255),
  contact_phone: z.string().max(50).optional(),
  source: z.enum(["organic", "referral", "meta_ads", "google_ads", "other"]),
  estimated_value: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  expected_close_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | undefined;
};

export function NewLeadDialog({ open, onOpenChange, workspaceId }: Props) {
  const create = useCreateLead(workspaceId);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      company_name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      source: "referral" as LeadSource,
      estimated_value: null as any,
      expected_close_date: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await create.mutateAsync({
        company_name: values.company_name,
        contact_name: values.contact_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone || undefined,
        source: values.source,
        estimated_value: values.estimated_value ?? null,
        expected_close_date: values.expected_close_date || null,
        notes: values.notes || undefined,
      });
      toast.success("Lead creado");
      form.reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>Cargá manualmente un prospecto al pipeline.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-3">
          <div>
            <Label>Empresa</Label>
            <Input {...form.register("company_name")} />
            {form.formState.errors.company_name && (
              <p className="text-xs text-destructive">{form.formState.errors.company_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contacto</Label>
              <Input {...form.register("contact_name")} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" {...form.register("contact_email")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono</Label>
              <Input {...form.register("contact_phone")} />
            </div>
            <div>
              <Label>Fuente</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(v) => form.setValue("source", v as LeadSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAD_SOURCE_LABEL) as LeadSource[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor estimado (USD)</Label>
              <Input type="number" step="1" min="0" {...form.register("estimated_value" as any)} />
            </div>
            <div>
              <Label>Cierre esperado</Label>
              <Input type="date" {...form.register("expected_close_date")} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={3} {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
