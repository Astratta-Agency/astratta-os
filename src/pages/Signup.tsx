import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { toast } from "@/hooks/use-toast";

export default function Signup() {
  const navigate = useNavigate();
  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      navigate("/onboarding");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { full_name: fullName, workspace_name: agencyName },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(translateAuthError(signUpError.message));
      return;
    }

    // If the project requires email confirmation, there is no session yet.
    if (!data.session) {
      setLoading(false);
      toast({
        title: "Revisa tu correo",
        description: "Te enviamos un enlace para confirmar tu cuenta.",
      });
      navigate("/login");
      return;
    }

    // Create the workspace via RPC (owner membership is auto-created by trigger)
    const { error: rpcError } = await supabase.rpc("create_workspace", {
      _name: agencyName,
      _slug: null,
    });
    setLoading(false);

    if (rpcError) {
      setError(translateAuthError(rpcError.message));
      return;
    }

    navigate("/onboarding", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="flex">
            <div className="w-1.5 bg-primary" aria-hidden />
            <div className="flex-1 p-8">
              <h1 className="font-display text-2xl font-bold leading-tight text-foreground">
                Empieza a operar tu agencia como un studio
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea tu workspace y conecta clientes, proyectos y reportes en un solo lugar.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agency">Nombre de la agencia</Label>
                  <Input
                    id="agency"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Astratta Agency"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Tu nombre</Label>
                  <Input
                    id="fullName"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ana Pérez"
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
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
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
