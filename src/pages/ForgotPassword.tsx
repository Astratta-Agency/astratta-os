import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { Check } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Backend no conectado.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Recupera tu acceso
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {sent ? (
            <div className="mt-6 flex items-start gap-3 rounded-input bg-muted p-4 text-sm">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div>
                <p className="font-semibold text-foreground">Revisa tu correo</p>
                <p className="mt-0.5 text-muted-foreground">
                  Si esa dirección está registrada, recibirás un correo en unos minutos.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando…" : "Enviar enlace"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
