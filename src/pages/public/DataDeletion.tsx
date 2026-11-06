import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { LegalLayout, LEGAL_CONTACT_EMAIL, useLegalLang } from "@/components/shared/legal-layout";

type DeletionStatus = "pending" | "completed" | "failed";

const CONTENT = {
  es: {
    title: "Eliminación de datos",
    intro:
      "Puedes pedir que eliminemos los datos que Astratta OS obtuvo de tus cuentas de Facebook, Instagram o TikTok: los tokens de acceso, las métricas y los datos de audiencia de esas cuentas.",
    fromPlatform: "Desde Facebook o Instagram",
    fromPlatformSteps: [
      "En Facebook, abre Configuración y privacidad → Configuración → Integraciones comerciales (o Apps y sitios web).",
      "Busca Astratta OS, elimínala y solicita que se borren tus datos.",
      "Meta nos envía la solicitud, borramos los datos de inmediato y te da un enlace para consultar el estado con tu código de confirmación.",
    ],
    byEmail: "Por correo",
    byEmailBody: `Escribe a ${LEGAL_CONTACT_EMAIL} indicando la cuenta afectada. Te responderemos en un máximo de 30 días. Este es también el camino para TikTok y para eliminar otros datos de tu cuenta de Astratta OS.`,
    statusTitle: "Estado de tu solicitud",
    code: "Código de confirmación",
    loading: "Consultando…",
    notFound: "No encontramos una solicitud con ese código.",
    error: "No pudimos consultar el estado. Inténtalo de nuevo más tarde.",
    status: {
      pending: "En proceso.",
      completed: "Completada: tus datos fueron eliminados.",
      failed: `No se pudo completar. Escríbenos a ${LEGAL_CONTACT_EMAIL} con este código.`,
    },
  },
  en: {
    title: "Data deletion",
    intro:
      "You can ask us to delete the data Astratta OS obtained from your Facebook, Instagram or TikTok accounts: access tokens, metrics and audience data for those accounts.",
    fromPlatform: "From Facebook or Instagram",
    fromPlatformSteps: [
      "On Facebook, open Settings & privacy → Settings → Business integrations (or Apps and websites).",
      "Find Astratta OS, remove it and request that your data be deleted.",
      "Meta sends us the request, we delete the data immediately, and you get a link to check the status with your confirmation code.",
    ],
    byEmail: "By email",
    byEmailBody: `Write to ${LEGAL_CONTACT_EMAIL} naming the affected account. We will respond within 30 days. This is also the route for TikTok and for deleting other data in your Astratta OS account.`,
    statusTitle: "Status of your request",
    code: "Confirmation code",
    loading: "Checking…",
    notFound: "We could not find a request with that code.",
    error: "We could not check the status. Please try again later.",
    status: {
      pending: "In progress.",
      completed: "Completed: your data has been deleted.",
      failed: `Could not be completed. Write to ${LEGAL_CONTACT_EMAIL} with this code.`,
    },
  },
};

async function fetchDeletionStatus(code: string): Promise<DeletionStatus | null> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-data-deletion?code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`status_${res.status}`);
  const body = await res.json();
  return body.status as DeletionStatus;
}

export default function DataDeletion() {
  const [lang, setLang] = useLegalLang();
  const [params] = useSearchParams();
  const code = params.get("code");
  const content = CONTENT[lang];

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ["data-deletion-status", code],
    queryFn: () => fetchDeletionStatus(code!),
    enabled: !!code,
    retry: false,
  });

  return (
    <LegalLayout lang={lang} onLangChange={setLang}>
      <h1 className="text-2xl font-bold text-neutral-900">{content.title}</h1>

      {code && (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="font-semibold text-neutral-900">{content.statusTitle}</h2>
          <p className="mt-1 break-all text-sm text-neutral-500">
            {content.code}: {code}
          </p>
          <p className="mt-2" role="status">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {content.loading}
              </span>
            ) : isError ? (
              content.error
            ) : status ? (
              content.status[status]
            ) : (
              content.notFound
            )}
          </p>
        </section>
      )}

      <p className="mt-6 leading-relaxed">{content.intro}</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-neutral-900">{content.fromPlatform}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
          {content.fromPlatformSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-neutral-900">{content.byEmail}</h2>
        <p className="mt-2 leading-relaxed">{content.byEmailBody}</p>
      </section>
    </LegalLayout>
  );
}
