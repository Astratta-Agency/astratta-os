import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { translateAuthError } from "@/lib/auth-errors";
import { toast } from "@/hooks/use-toast";

const SERVICES = [
  { key: "web_dev", label: "Web Development" },
  { key: "social_media", label: "Social Media" },
  { key: "paid_ads", label: "Paid Ads" },
  { key: "graphic_design", label: "Graphic Design" },
  { key: "branding", label: "Branding" },
  { key: "audit", label: "Auditoría" },
] as const;

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ctx, refetch } = useUserContext();
  const queryClient = useQueryClient();

  const workspace = useMemo(() => ctx?.workspaces?.[0]?.workspace, [ctx]);
  const workspaceId = workspace?.id;

  const [step, setStep] = useState<Step>(1);
  const [agencyName, setAgencyName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("Dallas-Fort Worth, TX");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [services, setServices] = useState<Record<string, boolean>>({
    web_dev: true,
    social_media: true,
    paid_ads: false,
    graphic_design: false,
    branding: false,
    audit: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) {
      setAgencyName(workspace.name);
      setLogoPreview(workspace.logo_url);
    }
  }, [workspace]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setError("El logo debe pesar menos de 2 MB.");
      return;
    }
    setError(null);
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const toggleService = (key: string) =>
    setServices((s) => ({ ...s, [key]: !s[key] }));

  const handleFinish = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      navigate("/app/dashboard");
      return;
    }
    if (!workspaceId || !user) {
      setError("No encontramos tu workspace. Inicia sesión nuevamente.");
      return;
    }

    setSaving(true);

    let logoUrl = workspace?.logo_url ?? null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${workspaceId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("workspace-logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
      if (upErr) {
        setSaving(false);
        setError(translateAuthError(upErr.message));
        return;
      }
      const { data: pub } = supabase.storage.from("workspace-logos").getPublicUrl(path);
      logoUrl = pub.publicUrl;
    }

    const servicesPayload = SERVICES.map((s) => ({
      key: s.key,
      label: s.label,
      enabled: !!services[s.key],
    }));

    const { error: updErr } = await supabase
      .from("workspaces")
      .update({
        name: agencyName,
        logo_url: logoUrl,
        website: website || null,
        location,
        services: servicesPayload,
        onboarded_at: new Date().toISOString(),
      } as never)
      .eq("id", workspaceId);

    setSaving(false);

    if (updErr) {
      setError(translateAuthError(updErr.message));
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["user-context"] });
    await refetch();
    toast({ title: "Listo", description: "Tu workspace está activo." });
    navigate("/app/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 rounded-full transition-all",
                n === step ? "w-8 bg-primary" : "w-3 bg-border",
              )}
            />
          ))}
        </div>

        <Card className="p-8">
          {step === 1 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Configura tu workspace
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Empecemos con la identidad visual de tu agencia.
              </p>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label>Logo de la agencia</Label>
                  <label className="flex cursor-pointer items-center gap-4 rounded-input border border-dashed border-border p-4 hover:bg-muted">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {logoPreview ? (
                        // eslint-disable-next-line jsx-a11y/img-redundant-alt
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-foreground">
                        {logoFile ? logoFile.name : "Sube tu logo"}
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Máx 2 MB.</p>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agencyName">Nombre de la agencia</Label>
                  <Input
                    id="agencyName"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="website">Sitio web (opcional)</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-8 flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!agencyName.trim()}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                ¿Qué servicios ofreces?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona los que aplican. Podrás cambiarlos después.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {SERVICES.map((s) => {
                  const active = !!services[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleService(s.key)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {active && <Check className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} />}
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Todo listo
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vamos a guardar tu configuración y abrir tu workspace.
              </p>

              <div className="mt-6 space-y-3 rounded-input bg-muted p-4 text-sm">
                <Row label="Agencia" value={agencyName} />
                <Row label="Ubicación" value={location} />
                {website && <Row label="Sitio web" value={website} />}
                <Row
                  label="Servicios"
                  value={
                    SERVICES.filter((s) => services[s.key])
                      .map((s) => s.label)
                      .join(", ") || "—"
                  }
                />
              </div>

              {error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={saving}>
                  Atrás
                </Button>
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? "Guardando…" : "Abrir mi workspace"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
