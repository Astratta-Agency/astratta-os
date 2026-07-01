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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteTeamMember } from "@/hooks/useTeam";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Correo inválido").max(255),
  role: z.enum(["team_member", "collaborator"]),
  title: z.string().max(120).optional(),
  weekly_capacity_hours: z.coerce.number().min(0).max(168).default(40),
  hourly_rate: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
};

export function InviteTeamMemberDialog({ open, onOpenChange, workspaceId }: Props) {
  const [fallback, setFallback] = useState<{ email: string; actionUrl?: string } | null>(null);
  const invite = useInviteTeamMember(workspaceId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "team_member", title: "", weekly_capacity_hours: 40 },
  });
  const role = form.watch("role");

  const handleClose = (v: boolean) => {
    if (!v) {
      form.reset();
      setFallback(null);
    }
    onOpenChange(v);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await invite.mutateAsync({
        email: values.email,
        role: values.role,
        title: values.title || undefined,
        weekly_capacity_hours: values.weekly_capacity_hours,
        hourly_rate: values.role === "collaborator" ? values.hourly_rate : undefined,
      });
      if (res.emailed) {
        toast({ title: `Invitación enviada a ${values.email}` });
        handleClose(false);
      } else {
        setFallback({ email: values.email, actionUrl: res.actionUrl });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message ?? "No se pudo enviar la invitación",
        variant: "destructive",
      });
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {!fallback ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Invitar miembro</DialogTitle>
              <DialogDescription>
                La persona recibirá un correo con el link para activar su cuenta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="email">Correo *</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={role}
                onValueChange={(v) => form.setValue("role", v as FormValues["role"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_member">Equipo interno</SelectItem>
                  <SelectItem value="collaborator">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título / cargo</Label>
              <Input id="title" placeholder="Community Manager" {...form.register("title")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap">Capacidad semanal (horas)</Label>
              <Input id="cap" type="number" min={0} max={168} {...form.register("weekly_capacity_hours")} />
            </div>

            {role === "collaborator" && (
              <div className="space-y-2">
                <Label htmlFor="rate">Tarifa por hora</Label>
                <Input id="rate" type="number" min={0} {...form.register("hourly_rate")} />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
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
                <Check className="h-5 w-5 text-primary" /> Miembro añadido
              </DialogTitle>
              <DialogDescription>
                No pudimos enviar el correo automáticamente. Compartí este enlace manualmente:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Enlace</Label>
              <div className="flex gap-2">
                <Input readOnly value={fallback.actionUrl ?? `${window.location.origin}/login`} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(fallback.actionUrl ?? `${window.location.origin}/login`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ingresa con: <span className="font-medium">{fallback.email}</span>
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
