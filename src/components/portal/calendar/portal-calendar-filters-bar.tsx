import { useState } from "react";
import { Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  CHANNEL_LABEL,
  POST_STATE_META,
  type Channel,
  type PostStatus,
} from "@/lib/post-states";
import { ChannelIcon } from "@/components/calendar/channel-icon";

// Statuses the client is ever allowed to see in the portal.
export const PORTAL_VISIBLE_STATUSES: PostStatus[] = [
  "pending_approval",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "rejected",
];

interface Props {
  channels: Channel[];
  onChannels: (v: Channel[]) => void;
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

function MultiSelect<T extends string>({
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
          className={cn("w-full justify-between md:w-48", className)}
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
                    <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
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

export function PortalCalendarFiltersBar(props: Props) {
  const channelOptions: Option<Channel>[] = CHANNELS.map((c) => ({
    value: c,
    label: CHANNEL_LABEL[c],
    icon: <ChannelIcon channel={c} size="sm" />,
  }));
  const statusOptions: Option<PostStatus>[] = PORTAL_VISIBLE_STATUSES.map((s) => ({
    value: s,
    label: POST_STATE_META[s].label,
    color: POST_STATE_META[s].color,
  }));

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 md:flex-row md:flex-wrap md:items-center">
      <MultiSelect
        options={channelOptions}
        selected={props.channels}
        onChange={props.onChannels}
        placeholder="Todos los canales"
      />
      <MultiSelect
        options={statusOptions}
        selected={props.statuses}
        onChange={props.onStatuses}
        placeholder="Todos los estados"
      />
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
  );
}
