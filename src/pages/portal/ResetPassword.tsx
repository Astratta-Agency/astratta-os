import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { Check } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

/**
 * Portal recovery landing page — opened via the link from the portal invite
 * or password reset email. Sets a new password using the recovery session
 * that Supabase auto-applies.
 */
export default function PortalResetPassword() {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/portal", { replace: true }), 1500);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="p-8">
          <span className="inline-block rounded-input bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Portal de cliente
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
            Crea tu contraseña
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una contraseña para acceder a tu portal.
          </p>

          {done ? (
            <div className="mt-6 flex items-start gap-3 rounded-input bg-muted p-4 text-sm">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div>
                <p className="font-semibold text-foreground">Listo</p>
                <p className="mt-0.5 text-muted-foreground">
                  Tu contraseña fue creada. Te llevamos a tu portal.
                </p>
              </div>
            </div>
          ) : !recoveryReady && isSupabaseConfigured ? (
            <p className="mt-6 rounded-input bg-muted p-4 text-sm text-muted-foreground">
              Abre este enlace desde el correo de invitación para continuar.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando…" : "Crear contraseña y entrar"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link to="/portal/login" className="font-semibold text-primary hover:underline">
              Volver al portal
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
