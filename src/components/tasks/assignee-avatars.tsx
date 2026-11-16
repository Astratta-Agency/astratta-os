import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "@/hooks/useProjects";

export function memberDisplay(members: WorkspaceMember[], id: string) {
  const m = members.find((x) => x.user_id === id);
  const name = m ? m.full_name || m.email || "Miembro" : "Miembro";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return { id, name, initials, avatar: m?.avatar_url ?? null };
}

interface Props {
  ids: string[];
  members: WorkspaceMember[];
  /** Max avatars before collapsing into "+N". */
  max?: number;
  size?: "sm" | "md";
  /** Show the member name next to the avatar when there is a single assignee. */
  showName?: boolean;
  className?: string;
}

/** Stacked avatars for the assignees of a task. Renders "—" when empty. */
export function AssigneeAvatars({ ids, members, max = 3, size = "sm", showName = false, className }: Props) {
  if (ids.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  const people = ids.map((id) => memberDisplay(members, id));
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const title = people.map((p) => p.name).join(", ");

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} title={title}>
      <div className="flex shrink-0 -space-x-2">
        {shown.map((p) => (
          <Avatar key={p.id} className={cn(dim, "border-2 border-background")}>
            {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
            <AvatarFallback className="text-[10px]">{p.initials}</AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 && (
          <span
            className={cn(
              dim,
              "flex items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground",
            )}
          >
            +{extra}
          </span>
        )}
      </div>
      {showName && people.length === 1 && <span className="truncate text-xs">{people[0].name}</span>}
    </div>
  );
}
