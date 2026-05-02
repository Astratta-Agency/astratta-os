import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast({
        title: "Backend no conectado",
        description: "Conecta Supabase para activar el portal.",
      });
      navigate("/portal");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Error al iniciar sesión", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/portal", { replace: true });
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
            Accede al portal de tu agencia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Tu agencia te invitó a colaborar aquí.</p>

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
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link to="/portal/forgot-password" className="font-semibold text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
