import { ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { AssigneeAvatars, memberDisplay } from "./assignee-avatars";

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  members: WorkspaceMember[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Multi-select of workspace members (checkbox list in a popover). */
export function AssigneeMultiSelect({
  value,
  onChange,
  members,
  placeholder = "Sin asignar",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? memberDisplay(members, value[0]).name
        : `${value.length} asignados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value.length > 0 && <AssigneeAvatars ids={value} members={members} max={3} />}
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>{label}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-1" align="start">
        <div className="max-h-64 overflow-y-auto">
          {members.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No hay miembros.</p>
          )}
          {members.map((m) => {
            const d = memberDisplay(members, m.user_id);
            const checked = value.includes(m.user_id);
            return (
              <label
                key={m.user_id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(m.user_id)} />
                <AssigneeAvatars ids={[m.user_id]} members={members} />
                <span className="truncate">{d.name}</span>
              </label>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => onChange([])}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Quitar todos
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
