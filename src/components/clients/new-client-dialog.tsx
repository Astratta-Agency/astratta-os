import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useCreateClient } from "@/hooks/useClients";
import { INDUSTRIES } from "./clients-filters";

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color HEX inválido")
  .optional()
  .or(z.literal(""));

const schema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120),
  industry: z.string().min(1, "Requerido"),
  website: z.string().trim().max(255).url("URL inválida").optional().or(z.literal("")),
  location: z.string().trim().min(1, "Requerido").max(120),
  status: z.enum(["prospect", "active", "paused", "churned"]),
  brand_primary_color: hex,
  brand_secondary_color: hex,
  logo_url: z.string().trim().max(500).url("URL inválida").optional().or(z.literal("")),
  contact_name: z.string().trim().min(1, "Requerido").max(120),
  contact_email: z.string().trim().email("Email inválido").max(255),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  contact_role: z.string().trim().max(80).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
}

export function NewClientDialog({ open, onOpenChange, workspaceId }: Props) {
  const navigate = useNavigate();
  const create = useCreateClient(workspaceId);
  const [brandOpen, setBrandOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      industry: "",
      website: "",
      location: "Dallas-Fort Worth, TX",
      status: "prospect",
      brand_primary_color: "#5140f2",
      brand_secondary_color: "#ff7503",
      logo_url: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      contact_role: "",
    },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      const created = await create.mutateAsync({
        name: v.name,
        industry: v.industry,
        website: v.website || undefined,
        location: v.location,
        status: v.status,
        brand_primary_color: v.brand_primary_color || undefined,
        brand_secondary_color: v.brand_secondary_color || undefined,
        logo_url: v.logo_url || undefined,
        contact: {
          name: v.contact_name,
          email: v.contact_email,
          phone: v.contact_phone || undefined,
          role: v.contact_role || undefined,
        },
      });
      toast({ title: "Cliente creado", description: v.name });
      onOpenChange(false);
      form.reset();
      navigate(`/app/clientes/${created.slug}`);
    } catch (e: any) {
      toast({
        title: "Error al crear cliente",
        description: e?.message ?? "Intenta de nuevo",
        variant: "destructive",
      });
    }
  };

  const errs = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>Crea un cliente y su contacto principal.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Datos generales</h4>

            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre comercial *</Label>
              <Input id="name" {...form.register("name")} />
              {errs.name && <p className="text-xs text-destructive">{errs.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industria *</Label>
                <Select
                  value={form.watch("industry")}
                  onValueChange={(v) => form.setValue("industry", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errs.industry && (
                  <p className="text-xs text-destructive">{errs.industry.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", v as FormValues["status"], { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospecto</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" placeholder="https://…" {...form.register("website")} />
              {errs.website && <p className="text-xs text-destructive">{errs.website.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Ubicación</Label>
              <Input id="location" {...form.register("location")} />
            </div>
          </section>

          <Collapsible open={brandOpen} onOpenChange={setBrandOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm font-medium"
              >
                Brand del cliente (opcional)
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${brandOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input id="logo_url" placeholder="https://…" {...form.register("logo_url")} />
                {errs.logo_url && (
                  <p className="text-xs text-destructive">{errs.logo_url.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Color primario</Label>
                  <Input type="color" {...form.register("brand_primary_color")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Color secundario</Label>
                  <Input type="color" {...form.register("brand_secondary_color")} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Contacto principal</h4>
            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Nombre *</Label>
              <Input id="contact_name" {...form.register("contact_name")} />
              {errs.contact_name && (
                <p className="text-xs text-destructive">{errs.contact_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Email *</Label>
              <Input id="contact_email" type="email" {...form.register("contact_email")} />
              {errs.contact_email && (
                <p className="text-xs text-destructive">{errs.contact_email.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">Teléfono</Label>
                <Input id="contact_phone" {...form.register("contact_phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_role">Rol</Label>
                <Input id="contact_role" placeholder="CEO, Marketing…" {...form.register("contact_role")} />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
