import { Navigate, useSearchParams } from "react-router-dom";
import { useUserContext } from "@/hooks/useUserContext";

export default function PortalRedirect() {
  const { data, isLoading } = useUserContext();
  const [params] = useSearchParams();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const clients = data?.clients ?? [];

  if (clients.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-bold">No tienes acceso a ningún portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pídele a tu agencia que te envíe una invitación.
          </p>
          <a
            href="mailto:hola@astrattaagency.com"
            className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Contactar soporte
          </a>
        </div>
      </div>
    );
  }

  if (clients.length === 1) {
    const qs = params.toString();
    return <Navigate to={`/portal/${clients[0].client.slug}${qs ? `?${qs}` : ""}`} replace />;
  }

  return <Navigate to={`/portal/${clients[0].client.slug}`} replace />;
}
