import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUserContext, type WorkspaceMembership } from "@/hooks/useUserContext";

const STORAGE_KEY = "astratta:active-workspace-id";

type ActiveWorkspaceContextValue = {
  /** The currently selected workspace, or null while loading / no membership. */
  workspace: WorkspaceMembership["workspace"] | null;
  /** The membership row (workspace + this user's role in it) for the active workspace. */
  activeMembership: WorkspaceMembership | null;
  /** Every workspace this user belongs to — for the switcher. */
  workspaces: WorkspaceMembership[];
  isLoading: boolean;
  setActiveWorkspaceId: (workspaceId: string) => void;
};

const ActiveWorkspaceContext = createContext<ActiveWorkspaceContextValue | null>(null);

/**
 * Owns which workspace is "active" for a session that may belong to several.
 * Persists the choice in localStorage so it survives a reload, and falls back
 * to the first membership whenever the persisted id doesn't resolve to one —
 * covers a fresh session, a different account on the same browser, or the
 * user having been removed from that workspace since the last visit.
 *
 * Mount once, above everything under /app (see AppShell).
 */
export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useUserContext();
  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const activeMembership = useMemo(() => {
    if (workspaces.length === 0) return null;
    const persisted = selectedId ? workspaces.find((w) => w.workspace_id === selectedId) : undefined;
    return persisted ?? workspaces[0];
  }, [workspaces, selectedId]);

  // Keep localStorage pointed at whatever actually resolved — covers both
  // "nothing persisted yet" and "persisted id no longer valid" in one place.
  useEffect(() => {
    if (!activeMembership || activeMembership.workspace_id === selectedId) return;
    window.localStorage.setItem(STORAGE_KEY, activeMembership.workspace_id);
    setSelectedId(activeMembership.workspace_id);
  }, [activeMembership, selectedId]);

  const setActiveWorkspaceId = (workspaceId: string) => {
    window.localStorage.setItem(STORAGE_KEY, workspaceId);
    setSelectedId(workspaceId);
  };

  const value: ActiveWorkspaceContextValue = {
    workspace: activeMembership?.workspace ?? null,
    activeMembership,
    workspaces,
    isLoading,
    setActiveWorkspaceId,
  };

  return <ActiveWorkspaceContext.Provider value={value}>{children}</ActiveWorkspaceContext.Provider>;
}

/**
 * Must be called under <ActiveWorkspaceProvider> (mounted in AppShell, so
 * every /app/* page and component already qualifies).
 */
export function useActiveWorkspace() {
  const ctx = useContext(ActiveWorkspaceContext);
  if (!ctx) {
    throw new Error("useActiveWorkspace must be used within an ActiveWorkspaceProvider");
  }
  return ctx;
}
