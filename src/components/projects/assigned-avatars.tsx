import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/hooks/useProjects";

interface Props {
  ids: string[];
  members: WorkspaceMember[];
  max?: number;
  size?: "sm" | "md";
}

export function AssignedAvatars({ ids, members, max = 3, size = "sm" }: Props) {
  const resolved = ids
    .map((id) => members.find((m) => m.user_id === id))
    .filter(Boolean) as WorkspaceMember[];
  if (resolved.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const visible = resolved.slice(0, max);
  const extra = resolved.length - visible.length;
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  const initialsOf = (m: WorkspaceMember) =>
    (m.full_name || m.email || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex -space-x-2">
        {visible.map((m) => (
          <Tooltip key={m.user_id}>
            <TooltipTrigger asChild>
              <Avatar className={cn("border-2 border-background", sz)}>
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name || ""} />}
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {initialsOf(m)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{m.full_name || m.email}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground",
                  sz,
                )}
              >
                +{extra}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {resolved
                .slice(max)
                .map((m) => m.full_name || m.email)
                .join(", ")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
