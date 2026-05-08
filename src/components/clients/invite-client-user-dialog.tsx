import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, Loader2 } from "lucide-react";
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
import { useInviteClientUser } from "@/hooks/useClientDetail";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Correo inválido").max(255),
  role: z.enum(["client_admin", "client_viewer"]),
  welcome_message: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientSlug: string;
  clientName: string;
};

export function InviteClientUserDialog({ open, onOpenChange, clientId, clientName }: Props) {
  const [success, setSuccess] = useState<{ email: string; emailed: boolean } | null>(null);
  const invite = useInviteClientUser(clientId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "client_viewer", welcome_message: "" },
  });

  const portalUrl = `${window.location.origin}/portal/login`;

  const handleClose = (v: boolean) => {
    if (!v) {
      form.reset();
      setSuccess(null);
    }
    onOpenChange(v);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await invite.mutateAsync(values);
      if (res.emailed) {
        toast({ title: `Invitación enviada a ${values.email}` });
        handleClose(false);
      } else {
        setSuccess({ email: values.email, emailed: false });
      }
    } catch (e: any) {
      const msg = e?.code === "23505"
        ? "Ya existe una invitación pendiente para ese correo"
        : e?.message ?? "No se pudo crear la invitación";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const buildMessage = () => {
    const wm = form.getValues("welcome_message");
    return [
      `Hola ${clientName},`,
      ``,
      `Te invitamos al portal de Astratta donde podrás aprobar contenido, ver reportes y acceder a tus documentos.`,
      ``,
      `Accede en: ${portalUrl}`,
      `Ingresa con este correo: ${success?.email ?? ""}`,
      wm ? `\n${wm}` : "",
    ].join("\n");
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {!success ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Invitar al portal</DialogTitle>
              <DialogDescription>
                Envía una invitación para que el cliente acceda a su portal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="email">Correo *</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@empresa.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as FormValues["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_viewer">Viewer (solo lectura)</SelectItem>
                  <SelectItem value="client_admin">Admin (aprobar y editar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcome_message">Mensaje de bienvenida (opcional)</Label>
              <Textarea
                id="welcome_message"
                rows={3}
                maxLength={500}
                placeholder="Ej: Hola Juan, te invitamos al portal donde aprobarás contenido..."
                {...form.register("welcome_message")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar invitación
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" /> Invitación creada
              </DialogTitle>
              <DialogDescription>
                El envío automático de correo estará disponible pronto. Por ahora, comparte este enlace con el cliente:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Enlace del portal</Label>
              <div className="flex gap-2">
                <Input readOnly value={portalUrl} />
                <Button type="button" variant="outline" onClick={() => copy(portalUrl, "Enlace copiado")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El cliente debe ingresar con: <span className="font-medium">{success.email}</span>
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => copy(buildMessage(), "Mensaje copiado")}
            >
              <Copy className="h-4 w-4" /> Copiar mensaje completo
            </Button>

            <DialogFooter>
              <Button type="button" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
