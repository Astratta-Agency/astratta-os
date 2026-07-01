import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConvertLeadToClient, type LeadRow } from "@/hooks/useSales";

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  industry: z.string().trim().min(1).max(120),
  website: z.string().max(500).optional(),
  location: z.string().trim().min(1).max(120),
  status: z.enum(["prospect", "active", "paused", "churned"]),
  contact_name: z.string().trim().min(1).max(255),
  contact_email: z.string().email().max(255),
  contact_phone: z.string().max(50).optional(),
});
type FormValues = z.infer<typeof schema>;

export function ConvertLeadDialog({
  lead,
  workspaceId,
  open,
  onOpenChange,
}: {
  lead: LeadRow | null;
  workspaceId: string | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const convert = useConvertLeadToClient();
  const [industry, setIndustry] = useState("Otros");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    values: lead
      ? {
          name: lead.company_name,
          industry: "Otros",
          website: "",
          location: "",
          status: "active",
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          contact_phone: lead.contact_phone ?? "",
        }
      : undefined,
  });

  if (!lead) return null;

  const onSubmit = async (v: FormValues) => {
    if (!workspaceId) return;
    try {
      await convert.mutateAsync({
        leadId: lead.id,
        workspaceId,
        client: {
          name: v.name,
          industry: v.industry,
          website: v.website,
          location: v.location,
          status: v.status,
          contact: {
            name: v.contact_name,
            email: v.contact_email,
            phone: v.contact_phone,
          },
        },
      });
      toast.success(`Cliente creado desde ${lead.company_name}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo convertir el lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convertir a cliente</DialogTitle>
          <DialogDescription>
            {lead.company_name} pasará a ser un cliente real. Podés completar los datos ahora o cerrar y hacerlo después desde el detalle del lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-3">
          <div>
            <Label>Nombre del cliente</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industria</Label>
              <Input {...form.register("industry")} />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input {...form.register("location")} placeholder="Ej. Buenos Aires, AR" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sitio web</Label>
              <Input {...form.register("website")} placeholder="https://…" />
            </div>
            <div>
              <Label>Estado inicial</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Contacto principal</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input {...form.register("contact_name")} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...form.register("contact_email")} />
              </div>
              <div className="col-span-2">
                <Label>Teléfono</Label>
                <Input {...form.register("contact_phone")} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Más tarde
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {convert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Convertir a cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
