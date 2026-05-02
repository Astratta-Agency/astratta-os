import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface RequireAuthProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function RequireAuth({ children, redirectTo = "/login" }: RequireAuthProps) {
  const { loading, session, configured } = useAuth();
  const location = useLocation();

  console.log("[RequireAuth] mounted, user:", session?.user?.id, "loading:", loading);

  // Until Supabase is connected, allow access so the team can preview the shell.
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
