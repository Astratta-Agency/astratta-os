import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";

interface Props {
  children: React.ReactNode;
  /** Allow rendering even if onboarding is not complete (e.g. /onboarding itself). */
  allowUnonboarded?: boolean;
}

export function RequireAgencyAuth({ children, allowUnonboarded = false }: Props) {
  const { loading, session, configured } = useAuth();
  const { data, isLoading } = useUserContext();
  const location = useLocation();

  // Backend not connected — let the team preview the shell
  if (!configured) return <>{children}</>;

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const workspaces = data?.workspaces ?? [];
  const clients = data?.clients ?? [];

  // Pure client user → portal
  if (workspaces.length === 0 && clients.length > 0) {
    return <Navigate to="/portal/login" replace />;
  }

  // No memberships at all → onboarding (likely a fresh signup whose RPC
  // hasn't run yet, or a stale session). Send to login as a safe default.
  if (workspaces.length === 0) {
    return <Navigate to="/login" replace />;
  }

  // Force onboarding if no workspace has been onboarded yet
  const anyOnboarded = workspaces.some((w) => w.workspace.onboarded_at);
  if (!anyOnboarded && !allowUnonboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
