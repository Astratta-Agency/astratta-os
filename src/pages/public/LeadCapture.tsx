import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const SERVICE_OPTIONS = [
  "Social Media Management",
  "Branding / Diseño",
  "Desarrollo Web",
  "Publicidad (Ads)",
] as const;

const REFERRAL_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "Google / Búsqueda web",
  "Referido",
  "Otro",
] as const;

const schema = z.object({
  contact_name: z.string().trim().min(1, "Requerido").max(255),
  contact_email: z.string().email("Email inválido").max(255),
  contact_phone: z.string().trim().min(1, "Requerido").max(50),
  service_interest: z.string().min(1, "Seleccioná un servicio"),
  notes: z.string().trim().min(1, "Requerido").max(2000),
  referral_sources: z.array(z.string()).min(1, "Seleccioná al menos una opción"),
  website_url_confirm: z.string().optional(), // honeypot
});
type FormValues = z.infer<typeof schema>;

type WorkspaceIdentity = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

function useWorkspaceIdentity(slug: string | undefined) {
  return useQuery<WorkspaceIdentity | null>({
    queryKey: ["workspace-public-identity", slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_workspace_public_identity", {
        p_slug: slug,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as WorkspaceIdentity | null;
    },
  });
}

export default function LeadCapture() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: identity } = useWorkspaceIdentity(workspaceSlug);
  const brandName = identity?.name ?? "Astratta Agency";
  const primaryColor = identity?.primary_color || "#5140f2";
  const accentColor = identity?.secondary_color || "#ff7503";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      service_interest: "",
      notes: "",
      referral_sources: [],
      website_url_confirm: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!workspaceSlug) {
      setStatus("error");
      setErrorMsg("URL inválida");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);

    const params = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
    };

    try {
      const { data, error } = await supabase.functions.invoke("capture-lead", {
        body: {
          workspace_slug: workspaceSlug,
          contact_name: values.contact_name,
          contact_email: values.contact_email,
          contact_phone: values.contact_phone,
          service_interest: values.service_interest,
          notes: values.notes,
          referral_sources: values.referral_sources,
          honeypot: values.website_url_confirm || undefined,
          ...utm,
        },
      });
      if (error) throw new Error(error.message);
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error ?? "No pudimos enviar tu solicitud");
      }
      setStatus("success");
      form.reset();
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message ?? "No pudimos enviar tu solicitud");
    }
  };

  return (
    <div
      className="min-h-screen w-full px-4 py-8"
      style={{ background: "linear-gradient(180deg, #f8f7ff 0%, #ffffff 100%)" }}
    >
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          {identity?.logo_url ? (
            <img
              src={identity.logo_url}
              alt={brandName}
              className="mx-auto mb-3 h-12 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <div
              className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: primaryColor }}
            >
              {brandName}
            </div>
          )}
          <h1 className="text-2xl font-semibold text-slate-900">Hablemos de tu proyecto</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contanos qué necesitás y te contactamos en menos de 24hs.
          </p>
        </div>

        {status === "success" ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: accentColor }} />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">¡Gracias!</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recibimos tu solicitud. Alguien del equipo te va a escribir a la brevedad.
            </p>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit as any)}
            className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"
          >
            <div>
              <Label>Nombre y apellido *</Label>
              <Input {...form.register("contact_name")} />
              {form.formState.errors.contact_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.contact_name.message}</p>
              )}
            </div>
            <div>
              <Label>Correo electrónico *</Label>
              <Input type="email" {...form.register("contact_email")} />
              {form.formState.errors.contact_email && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.contact_email.message}</p>
              )}
            </div>
            <div>
              <Label>Número de teléfono *</Label>
              <Input type="tel" {...form.register("contact_phone")} />
              {form.formState.errors.contact_phone && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.contact_phone.message}</p>
              )}
            </div>
            <div>
              <Label>¿Qué servicio te interesa? *</Label>
              <Controller
                control={form.control}
                name="service_interest"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.service_interest && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.service_interest.message}</p>
              )}
            </div>
            <div>
              <Label>Describe tu negocio *</Label>
              <Textarea
                rows={4}
                {...form.register("notes")}
                placeholder="A qué se dedica tu negocio, qué necesitás, tiempos, etc."
              />
              {form.formState.errors.notes && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.notes.message}</p>
              )}
            </div>
            <div>
              <Label>¿Cómo escuchaste de nosotros? *</Label>
              <Controller
                control={form.control}
                name="referral_sources"
                render={({ field }) => (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {REFERRAL_OPTIONS.map((option) => {
                      const checked = field.value.includes(option);
                      return (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              field.onChange(
                                v === true
                                  ? [...field.value, option]
                                  : field.value.filter((x) => x !== option),
                              );
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              {form.formState.errors.referral_sources && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.referral_sources.message as string}
                </p>
              )}
            </div>

            {/* Honeypot: hidden from real users. Bots that fill every field will fill this one and be silently dropped. */}
            <div style={{ display: "none" }} aria-hidden="true">
              <label>
                Confirmá tu sitio web
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  {...form.register("website_url_confirm")}
                />
              </label>
            </div>

            {status === "error" && errorMsg && (
              <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              className="w-full text-white"
              style={{ background: primaryColor }}
              disabled={status === "loading"}
            >
              {status === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              Al enviar aceptás que {brandName} te contacte por email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
