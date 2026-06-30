import { useEffect, useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { useUpdateClient, type ClientStatus } from "@/hooks/useClients";
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
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  client: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    location: string;
    status: ClientStatus;
    brand_primary_color: string | null;
    brand_secondary_color: string | null;
    logo_url: string | null;
  };
}

export function EditClientDialog({ open, onOpenChange, workspaceId, client }: Props) {
  const update = useUpdateClient(workspaceId);
  const [brandOpen, setBrandOpen] = useState(false);

  const buildDefaults = (): FormValues => ({
    name: client.name,
    industry: client.industry ?? "",
    website: client.website ?? "",
    location: client.location,
    status: client.status,
    brand_primary_color: client.brand_primary_color ?? "",
    brand_secondary_color: client.brand_secondary_color ?? "",
    logo_url: client.logo_url ?? "",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(buildDefaults());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    client.id,
    client.name,
    client.industry,
    client.website,
    client.location,
    client.status,
    client.brand_primary_color,
    client.brand_secondary_color,
    client.logo_url,
  ]);

  const onSubmit = async (v: FormValues) => {
    try {
      await update.mutateAsync({
        clientId: client.id,
        patch: {
          name: v.name,
          industry: v.industry,
          website: v.website || undefined,
          location: v.location,
          status: v.status,
          brand_primary_color: v.brand_primary_color || undefined,
          brand_secondary_color: v.brand_secondary_color || undefined,
          logo_url: v.logo_url || undefined,
        },
      });
      toast({ title: "Cliente actualizado", description: v.name });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Error al actualizar cliente",
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
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Actualiza los datos del cliente.</DialogDescription>
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
              {errs.location && (
                <p className="text-xs text-destructive">{errs.location.message}</p>
              )}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
