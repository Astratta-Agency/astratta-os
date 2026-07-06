import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useMyProfile";

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Ingresa tu nombre").max(80),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+\d\s()-]*$/, "Solo números, espacios, +, ( ) y -")
    .optional()
    .or(z.literal("")),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Ingresa tu contraseña actual"),
    new_password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Las contraseñas no coinciden",
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ClientProfile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: "", last_name: "", phone: "" },
  });

  useEffect(() => {
    if (!profile) return;
    profileForm.reset({
      first_name: profile.first_name ?? profile.full_name?.split(" ")[0] ?? "",
      last_name:
        profile.last_name ??
        (profile.first_name ? "" : profile.full_name?.split(" ").slice(1).join(" ") ?? ""),
      phone: profile.phone ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.first_name, profile?.last_name, profile?.phone]);

  const onSaveProfile = profileForm.handleSubmit(async (v) => {
    try {
      await updateProfile.mutateAsync({
        first_name: v.first_name,
        last_name: v.last_name ?? "",
        phone: v.phone ?? "",
      });
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
    } catch {
      toast({
        title: "No pudimos guardar tus datos",
        description: "Inténtalo de nuevo en unos segundos.",
        variant: "destructive",
      });
    }
  });

  // ---- Password ----
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const onChangePassword = passwordForm.handleSubmit(async (v) => {
    if (!user?.email) return;
    setChangingPassword(true);
    try {
      // Verify current password before allowing the change.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: v.current_password,
      });
      if (verifyError) {
        passwordForm.setError("current_password", {
          message: "La contraseña actual no es correcta",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: v.new_password });
      if (error) {
        toast({
          title: "No pudimos cambiar tu contraseña",
          description: translateAuthError(error.message),
          variant: "destructive",
        });
        return;
      }

      passwordForm.reset();
      toast({
        title: "Contraseña actualizada",
        description: "Usa tu nueva contraseña la próxima vez que inicies sesión.",
      });
    } finally {
      setChangingPassword(false);
    }
  });

  const pErrs = profileForm.formState.errors;
  const wErrs = passwordForm.formState.errors;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Mi Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tus datos personales y tu contraseña de acceso al portal.
        </p>
      </div>

      {/* Personal data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4" style={{ color: "var(--portal-primary)" }} />
            Datos personales
          </CardTitle>
          <CardDescription>Tu nombre aparecerá en el saludo del portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <Input
                  id="first_name"
                  autoComplete="given-name"
                  disabled={isLoading}
                  {...profileForm.register("first_name")}
                />
                {pErrs.first_name && (
                  <p className="text-xs text-destructive">{pErrs.first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <Input
                  id="last_name"
                  autoComplete="family-name"
                  disabled={isLoading}
                  {...profileForm.register("last_name")}
                />
                {pErrs.last_name && (
                  <p className="text-xs text-destructive">{pErrs.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Teléfono <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 (555) 000-0000"
                disabled={isLoading}
                {...profileForm.register("phone")}
              />
              {pErrs.phone && <p className="text-xs text-destructive">{pErrs.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" value={user?.email ?? ""} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                El correo de acceso no se puede cambiar desde el portal.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfile.isPending || isLoading}
                style={{ backgroundColor: "var(--portal-primary)" }}
              >
                {updateProfile.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" style={{ color: "var(--portal-primary)" }} />
            Cambiar contraseña
          </CardTitle>
          <CardDescription>
            Por seguridad, confirma tu contraseña actual antes de elegir una nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Contraseña actual</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("current_password")}
              />
              {wErrs.current_password && (
                <p className="text-xs text-destructive">{wErrs.current_password.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_password">Nueva contraseña</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  {...passwordForm.register("new_password")}
                />
                {wErrs.new_password && (
                  <p className="text-xs text-destructive">{wErrs.new_password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar contraseña</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("confirm_password")}
                />
                {wErrs.confirm_password && (
                  <p className="text-xs text-destructive">{wErrs.confirm_password.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={changingPassword}>
                {changingPassword ? "Actualizando…" : "Actualizar contraseña"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
