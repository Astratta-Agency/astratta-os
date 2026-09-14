import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function WorkspaceSwitcher() {
  const { workspace, workspaces, setActiveWorkspaceId, isLoading } = useActiveWorkspace();

  if (!workspace) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" aria-hidden={!isLoading} />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-3 font-semibold text-foreground hover:bg-muted">
          <Avatar className="h-6 w-6 rounded-md">
            <AvatarImage src={workspace.logo_url ?? undefined} alt={workspace.name} />
            <AvatarFallback className="rounded-md bg-foreground text-[11px] font-bold text-background">
              {initialsFor(workspace.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[12rem] truncate sm:inline">{workspace.name}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Workspace
        </DropdownMenuLabel>
        {workspaces.map((membership) => (
          <DropdownMenuItem
            key={membership.workspace_id}
            className="flex items-center justify-between gap-2"
            onSelect={() => setActiveWorkspaceId(membership.workspace_id)}
          >
            <span className="truncate">{membership.workspace.name}</span>
            {membership.workspace_id === workspace.id && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          + Crear workspace (próximamente)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
