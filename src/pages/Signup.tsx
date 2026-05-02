import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Signup() {
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      toast({
        title: "Backend no conectado",
        description: "Conecta Supabase para activar el registro.",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app/dashboard`,
        data: { workspace_name: workspaceName },
      },
    });
    setLoading(false);

    if (error) {
      toast({ title: "Error al crear cuenta", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Cuenta creada",
      description: "Revisa tu correo para confirmar tu dirección.",
    });
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="flex">
            <div className="w-1.5 bg-primary" aria-hidden />
            <div className="flex-1 p-8">
              <h1 className="font-display text-2xl font-bold text-foreground">Crea tu workspace</h1>
              <p className="mt-1 text-sm text-muted-foreground">Empieza a operar tu agencia desde un solo lugar.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace">Nombre de la agencia</Label>
                  <Input
                    id="workspace"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Mi Agencia DFW"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
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
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creando…" : "Crear workspace"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
