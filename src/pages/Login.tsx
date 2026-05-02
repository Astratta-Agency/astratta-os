import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      toast({
        title: "Backend no conectado",
        description: "Conecta Supabase para activar el inicio de sesión.",
      });
      navigate("/app/dashboard");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({ title: "Error al iniciar sesión", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/app/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="flex">
            <div className="w-1.5 bg-foreground" aria-hidden />
            <div className="flex-1 p-8">
              <h1 className="font-display text-2xl font-bold text-foreground">Bienvenida de vuelta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Accede a tu workspace de Astratta OS.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hola@tuagencia.com"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <Link to="/reset-password" className="text-xs font-medium text-primary hover:underline">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando…" : "Iniciar sesión"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Aún no tienes cuenta?{" "}
                <Link to="/signup" className="font-semibold text-primary hover:underline">
                  Crea tu workspace
                </Link>
              </p>
            </div>
          </div>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Eres cliente de una agencia?{" "}
          <Link to="/portal/login" className="font-semibold text-foreground hover:underline">
            Accede al portal
          </Link>
        </p>
      </div>
    </div>
  );
}
