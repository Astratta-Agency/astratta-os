import { useUserContext } from "@/hooks/useUserContext";

export function useActiveWorkspace() {
  const { data, isLoading } = useUserContext();
  const workspace = data?.workspaces?.[0]?.workspace ?? null;
  return { workspace, isLoading };
}
