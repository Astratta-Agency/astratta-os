import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TaskPriority, TaskType } from "@/hooks/useTasks";
import { PRIORITY_LABEL, TYPE_LABEL } from "@/lib/task-labels";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  types: TaskType[];
  onTypes: (v: TaskType[]) => void;
  priorities: TaskPriority[];
  onPriorities: (v: TaskPriority[]) => void;
  tags: string[];
  onTags: (v: string[]) => void;
  availableTags: string[];
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function TasksFiltersBar({
  search,
  onSearch,
  types,
  onTypes,
  priorities,
  onPriorities,
  tags,
  onTags,
  availableTags,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar tareas..."
          className="pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Tipo {types.length > 0 && <Badge variant="secondary" className="ml-1">{types.length}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Tipo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => (
            <DropdownMenuCheckboxItem
              key={t}
              checked={types.includes(t)}
              onCheckedChange={() => onTypes(toggle(types, t))}
              onSelect={(e) => e.preventDefault()}
            >
              {TYPE_LABEL[t]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Prioridad {priorities.length > 0 && <Badge variant="secondary" className="ml-1">{priorities.length}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel>Prioridad</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["p0", "p1", "p2", "p3"] as TaskPriority[]).map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={priorities.includes(p)}
              onCheckedChange={() => onPriorities(toggle(priorities, p))}
              onSelect={(e) => e.preventDefault()}
            >
              {PRIORITY_LABEL[p]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Etiquetas {tags.length > 0 && <Badge variant="secondary" className="ml-1">{tags.length}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel>Etiquetas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTags.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={tags.includes(t)}
                onCheckedChange={() => onTags(toggle(tags, t))}
                onSelect={(e) => e.preventDefault()}
              >
                {t}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(types.length > 0 || priorities.length > 0 || tags.length > 0 || search) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearch("");
            onTypes([]);
            onPriorities([]);
            onTags([]);
          }}
        >
          Limpiar
        </Button>
      )}
    </div>
  );
}
