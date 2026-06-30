import { useState } from "react";
import { Search, Filter, LayoutGrid, List as ListIcon, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPES,
  PROJECT_TYPE_LABEL,
} from "@/components/projects/project-meta";
import type { ProjectStatus, ProjectType } from "@/integrations/supabase/database.types";

export type View = "lista" | "kanban";

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  search: string;
  onSearch: (v: string) => void;
  clientIds: string[];
  onClientIds: (v: string[]) => void;
  clientOptions: ClientOption[];
  types: ProjectType[];
  onTypes: (v: ProjectType[]) => void;
  statuses: ProjectStatus[];
  onStatuses: (v: ProjectStatus[]) => void;
  assignedToMe: boolean;
  onAssignedToMe: (v: boolean) => void;
  view: View;
  onView: (v: View) => void;
  activeFiltersCount: number;
}

function MultiSelectDropdown<T extends string>({
  options,
  selected,
  onChange,
  labelMap,
  placeholder,
  width = "md:w-44",
}: {
  options: T[];
  selected: T[];
  onChange: (v: T[]) => void;
  labelMap: Record<T, string>;
  placeholder: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? labelMap[selected[0]]
        : `${selected.length} seleccionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-full justify-between", width)}>
          <span className="truncate">{label}</span>
          <Filter className="ml-2 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((o) => {
                const active = selected.includes(o);
                return (
                  <CommandItem
                    key={o}
                    onSelect={() =>
                      onChange(active ? selected.filter((x) => x !== o) : [...selected, o])
                    }
                  >
                    <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    {labelMap[o]}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ClientMulti({
  options,
  selected,
  onChange,
}: {
  options: ClientOption[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? "Todos los clientes"
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.name ?? "1 cliente"
        : `${selected.length} clientes`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between md:w-56">
          <span className="truncate">{label}</span>
          <Filter className="ml-2 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const active = selected.includes(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    onSelect={() =>
                      onChange(active ? selected.filter((x) => x !== o.id) : [...selected, o.id])
                    }
                  >
                    <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    {o.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FiltersBody(props: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
        <ClientMulti
          options={props.clientOptions}
          selected={props.clientIds}
          onChange={props.onClientIds}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MultiSelectDropdown
          options={PROJECT_TYPES}
          selected={props.types}
          onChange={props.onTypes}
          labelMap={PROJECT_TYPE_LABEL}
          placeholder="Todos los tipos"
        />
        <MultiSelectDropdown
          options={PROJECT_STATUS_ORDER}
          selected={props.statuses}
          onChange={props.onStatuses}
          labelMap={PROJECT_STATUS_LABEL}
          placeholder="Todos los status"
        />
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="assigned-me" className="text-sm">
          Asignados a mí
        </Label>
        <Switch
          id="assigned-me"
          checked={props.assignedToMe}
          onCheckedChange={props.onAssignedToMe}
        />
      </div>
    </div>
  );
}

export function ProjectsFiltersBar(props: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre de proyecto..."
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            className="pl-9"
          />
          {props.search && (
            <button
              type="button"
              onClick={() => props.onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Desktop inline filters */}
        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
          <ClientMulti
            options={props.clientOptions}
            selected={props.clientIds}
            onChange={props.onClientIds}
          />
          <MultiSelectDropdown
            options={PROJECT_TYPES}
            selected={props.types}
            onChange={props.onTypes}
            labelMap={PROJECT_TYPE_LABEL}
            placeholder="Todos los tipos"
          />
          <MultiSelectDropdown
            options={PROJECT_STATUS_ORDER}
            selected={props.statuses}
            onChange={props.onStatuses}
            labelMap={PROJECT_STATUS_LABEL}
            placeholder="Todos los status"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="assigned-me-d" className="text-xs text-muted-foreground">
              Asignados a mí
            </Label>
            <Switch
              id="assigned-me-d"
              checked={props.assignedToMe}
              onCheckedChange={props.onAssignedToMe}
            />
          </div>
        </div>

        {/* Mobile sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="md:hidden">
              <Filter className="mr-2 h-3.5 w-3.5" />
              Filtros
              {props.activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {props.activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FiltersBody {...props} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="inline-flex rounded-md border bg-background">
          <Button
            variant={props.view === "lista" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => props.onView("lista")}
            className="rounded-r-none"
          >
            <ListIcon className="mr-1.5 h-3.5 w-3.5" />
            Lista
          </Button>
          <Button
            variant={props.view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => props.onView("kanban")}
            className="rounded-l-none"
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
            Kanban
          </Button>
        </div>
      </div>
    </div>
  );
}
