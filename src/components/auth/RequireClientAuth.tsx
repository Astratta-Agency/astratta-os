import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";

interface Props {
  children: React.ReactNode;
}

export function RequireClientAuth({ children }: Props) {
  const { loading, session, configured } = useAuth();
  const { data, isLoading } = useUserContext();
  const params = useParams();
  const location = useLocation();

  if (!configured) return <>{children}</>;

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />;
  }

  const workspaces = data?.workspaces ?? [];
  const clients = data?.clients ?? [];

  // Pure agency user
  if (clients.length === 0 && workspaces.length > 0) {
    return <Navigate to="/login" replace />;
  }

  if (clients.length === 0) {
    return <Navigate to="/portal/login" replace />;
  }

  // If a slug is in the URL, ensure the user has access to it
  const slug = params.slug;
  if (slug && !clients.some((c) => c.client.slug === slug)) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
