import { useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  company_name: z.string().trim().min(1, "Requerido").max(255),
  contact_name: z.string().trim().min(1, "Requerido").max(255),
  contact_email: z.string().email("Email inválido").max(255),
  contact_phone: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  website_url_confirm: z.string().optional(), // honeypot
});
type FormValues = z.infer<typeof schema>;

export default function LeadCapture() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      company_name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      notes: "",
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
          company_name: values.company_name,
          contact_name: values.contact_name,
          contact_email: values.contact_email,
          contact_phone: values.contact_phone || undefined,
          notes: values.notes || undefined,
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
          <div
            className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ background: "#5140f2" }}
          >
            Astratta Agency
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Hablemos de tu proyecto</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contanos qué necesitás y te contactamos en menos de 24hs.
          </p>
        </div>

        {status === "success" ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: "#ff7503" }} />
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
              <Label>Empresa *</Label>
              <Input {...form.register("company_name")} />
              {form.formState.errors.company_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.company_name.message}</p>
              )}
            </div>
            <div>
              <Label>Tu nombre *</Label>
              <Input {...form.register("contact_name")} />
              {form.formState.errors.contact_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.contact_name.message}</p>
              )}
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" {...form.register("contact_email")} />
              {form.formState.errors.contact_email && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.contact_email.message}</p>
              )}
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input {...form.register("contact_phone")} />
            </div>
            <div>
              <Label>Contanos brevemente</Label>
              <Textarea rows={4} {...form.register("notes")} placeholder="Qué necesitás, tiempos, etc." />
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
              style={{ background: "#5140f2" }}
              disabled={status === "loading"}
            >
              {status === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              Al enviar aceptás que Astratta Agency te contacte por email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
