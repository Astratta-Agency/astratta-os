import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/brand/Logo";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user is already signed in, route them by client membership.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || !active) return;
      const { data: cu } = await supabase
        .from("client_users")
        .select("client:clients!inner(slug)")
        .eq("user_id", sess.session.user.id)
        .limit(1)
        .maybeSingle();
      const slug = (cu as { client?: { slug?: string } } | null)?.client?.slug;
      navigate(slug ? `/portal/${slug}` : "/portal", { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      navigate("/portal");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    // Look up client slug and redirect
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session) {
      const { data: cu } = await supabase
        .from("client_users")
        .select("client:clients!inner(slug)")
        .eq("user_id", sess.session.user.id)
        .limit(1)
        .maybeSingle();
      const slug = (cu as { client?: { slug?: string } } | null)?.client?.slug;
      navigate(slug ? `/portal/${slug}` : "/portal", { replace: true });
    } else {
      navigate("/portal", { replace: true });
    }
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
          <p className="mt-1 text-sm text-muted-foreground">
            Tu agencia te invitó a colaborar aquí.
          </p>

          <Tabs defaultValue="password" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Contraseña</TabsTrigger>
              <TabsTrigger value="magic">Enlace mágico</TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    autoComplete="current-password"
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
                  {loading ? "Entrando…" : "Iniciar sesión"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic" className="mt-4">
              <MagicLinkForm redirectTo="/portal" />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-sm">
            <Link
              to="/portal/forgot-password"
              className="font-semibold text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
