import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

interface Props {
  redirectTo: string;
  buttonLabel?: string;
}

export function MagicLinkForm({ redirectTo, buttonLabel = "Enviar enlace" }: Props) {
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${redirectTo}`,
        shouldCreateUser: false,
      },
    });
    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div
        role="status"
        className="mt-2 flex items-start gap-3 rounded-input bg-muted p-4 text-sm"
      >
        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div>
          <p className="font-semibold text-foreground">Revisa tu correo</p>
          <p className="mt-0.5 text-muted-foreground">
            Si esa dirección está registrada, te enviamos un enlace para iniciar sesión.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="magic-email">Correo</Label>
        <Input
          id="magic-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hola@tuagencia.com"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando…" : buttonLabel}
      </Button>
    </form>
  );
}
