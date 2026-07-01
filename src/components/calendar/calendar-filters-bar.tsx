import { useState } from "react";
import { Search, Filter, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  CHANNEL_LABEL,
  POST_STATE_META,
  POST_STATE_ORDER,
  type Channel,
  type PostStatus,
} from "@/lib/post-states";
import { ChannelIcon } from "./channel-icon";
import type { ContentPillar } from "@/hooks/useSocialPosts";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  channels: Channel[];
  onChannels: (v: Channel[]) => void;
  pillars: string[];
  onPillars: (v: string[]) => void;
  pillarOptions: ContentPillar[];
  statuses: PostStatus[];
  onStatuses: (v: PostStatus[]) => void;
  activeFiltersCount: number;
  onClear: () => void;
}

type Option<T extends string> = {
  value: T;
  label: string;
  color?: string;
  icon?: React.ReactNode;
};

function MultiSelectDropdown<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: {
  options: Option<T>[];
  selected: T[];
  onChange: (v: T[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} seleccionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full justify-between md:w-44", className)}
        >
          <span className="truncate">{label}</span>
          <Filter className="ml-2 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    onSelect={() =>
                      onChange(
                        active ? selected.filter((x) => x !== o.value) : [...selected, o.value],
                      )
                    }
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")}
                    />
                    {o.icon ? <span className="mr-2 inline-flex">{o.icon}</span> : null}
                    {o.color ? (
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: o.color }}
                      />
                    ) : null}
                    <span className="truncate">{o.label}</span>
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

function FiltersBody(p: Props) {
  const channelOptions: Option<Channel>[] = CHANNELS.map((c) => ({
    value: c,
    label: CHANNEL_LABEL[c],
    icon: <ChannelIcon channel={c} size="sm" />,
  }));
  const pillarOpts: Option<string>[] = p.pillarOptions.map((opt) => ({
    value: opt.id ?? "__none__",
    label: opt.name,
    color: opt.color,
  }));
  const statusOpts: Option<PostStatus>[] = POST_STATE_ORDER.map((s) => ({
    value: s,
    label: POST_STATE_META[s].label,
    color: POST_STATE_META[s].color,
  }));

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <MultiSelectDropdown
        options={channelOptions}
        selected={p.channels}
        onChange={p.onChannels}
        placeholder="Todos los canales"
      />
      <MultiSelectDropdown
        options={pillarOpts}
        selected={p.pillars}
        onChange={p.onPillars}
        placeholder="Todos los pilares"
        className="md:w-48"
      />
      <MultiSelectDropdown
        options={statusOpts}
        selected={p.statuses}
        onChange={p.onStatuses}
        placeholder="Todos los estados"
        className="md:w-48"
      />
    </div>
  );
}

export function CalendarFiltersBar(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
        <div className="relative flex-1 md:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por caption..."
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

        {/* Desktop inline dropdowns */}
        <div className="hidden md:block">
          <FiltersBody {...props} />
        </div>

        {/* Mobile sheet trigger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
          <SheetContent side="right" className="w-[320px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FiltersBody {...props} />
            </div>
          </SheetContent>
        </Sheet>

        {props.activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onClear}
            className="text-muted-foreground"
          >
            Limpiar
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
              {props.activeFiltersCount}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
