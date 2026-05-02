import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({ title: "Backend no conectado" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
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
          <h1 className="font-display text-2xl font-bold text-foreground">Recuperar acceso al portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace de recuperación.</p>

          {sent ? (
            <p className="mt-6 rounded-input bg-muted p-4 text-sm">
              Si esa dirección está registrada, recibirás un correo en unos minutos.
            </p>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando…" : "Enviar enlace"}
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
