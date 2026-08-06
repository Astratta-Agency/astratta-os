import { useForm, Controller } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateLead } from "@/hooks/useSales";
import { SERVICE_OPTIONS, REFERRAL_OPTIONS } from "@/lib/lead-options";

// Same required fields as the public lead capture form
// (src/pages/public/LeadCapture.tsx), plus a couple of internal-only
// pipeline fields (empresa, valor estimado, cierre esperado) that make
// sense when a rep is loading a lead manually.
const schema = z.object({
  company_name: z.string().trim().min(1, "Requerido").max(255),
  contact_name: z.string().trim().min(1, "Requerido").max(255),
  contact_email: z.string().email("Correo inválido").max(255),
  contact_phone: z.string().trim().min(1, "Requerido").max(50),
  service_interest: z.string().min(1, "Seleccioná un servicio"),
  notes: z.string().trim().min(1, "Requerido").max(2000),
  referral_sources: z.array(z.string()).min(1, "Seleccioná al menos una opción"),
  estimated_value: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  expected_close_date: z.string().optional(),
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
      service_interest: "",
      notes: "",
      referral_sources: [],
      estimated_value: null as any,
      expected_close_date: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await create.mutateAsync({
        company_name: values.company_name,
        contact_name: values.contact_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        service_interest: values.service_interest,
        referral_sources: values.referral_sources,
        estimated_value: values.estimated_value ?? null,
        expected_close_date: values.expected_close_date || null,
        notes: values.notes,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Cargá manualmente un prospecto al pipeline con los mismos datos que pedimos en el
            formulario público.
          </DialogDescription>
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
              {form.formState.errors.contact_name && (
                <p className="text-xs text-destructive">{form.formState.errors.contact_name.message}</p>
              )}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" {...form.register("contact_email")} />
              {form.formState.errors.contact_email && (
                <p className="text-xs text-destructive">{form.formState.errors.contact_email.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input type="tel" {...form.register("contact_phone")} />
            {form.formState.errors.contact_phone && (
              <p className="text-xs text-destructive">{form.formState.errors.contact_phone.message}</p>
            )}
          </div>
          <div>
            <Label>¿Qué servicio le interesa?</Label>
            <Controller
              control={form.control}
              name="service_interest"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.service_interest && (
              <p className="text-xs text-destructive">{form.formState.errors.service_interest.message}</p>
            )}
          </div>
          <div>
            <Label>Describe el negocio</Label>
            <Textarea
              rows={3}
              {...form.register("notes")}
              placeholder="A qué se dedica, qué necesita, tiempos, etc."
            />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive">{form.formState.errors.notes.message}</p>
            )}
          </div>
          <div>
            <Label>¿Cómo se enteró de nosotros?</Label>
            <Controller
              control={form.control}
              name="referral_sources"
              render={({ field }) => (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {REFERRAL_OPTIONS.map((option) => {
                    const checked = field.value.includes(option);
                    return (
                      <label
                        key={option}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            field.onChange(
                              v === true
                                ? [...field.value, option]
                                : field.value.filter((x) => x !== option),
                            );
                          }}
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {form.formState.errors.referral_sources && (
              <p className="text-xs text-destructive">
                {form.formState.errors.referral_sources.message as string}
              </p>
            )}
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
