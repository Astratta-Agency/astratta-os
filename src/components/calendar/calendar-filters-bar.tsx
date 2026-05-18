import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_LABEL, POST_STATE_META, POST_STATE_ORDER, type Channel, type PostStatus } from "@/lib/post-states";
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

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function FiltersBody(p: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Canal</Label>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => {
            const active = p.channels.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => p.onChannels(toggle(p.channels, c))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/60",
                )}
              >
                <ChannelIcon channel={c} size="sm" />
                {CHANNEL_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pilar</Label>
        <div className="flex flex-wrap gap-1.5">
          {p.pillarOptions.map((opt) => {
            const key = opt.id ?? "__none__";
            const active = p.pillars.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => p.onPillars(toggle(p.pillars, key))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: opt.color }} />
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
        <div className="flex flex-wrap gap-1.5">
          {POST_STATE_ORDER.map((s) => {
            const active = p.statuses.includes(s);
            const meta = POST_STATE_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => p.onStatuses(toggle(p.statuses, s))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active ? "" : "text-muted-foreground hover:border-primary/60",
                )}
                style={
                  active
                    ? { borderColor: meta.color, backgroundColor: `${meta.color}1f`, color: meta.color }
                    : undefined
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarFiltersBar(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
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
          <Button variant="ghost" size="sm" onClick={props.onClear} className="text-muted-foreground">
            Limpiar
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
              {props.activeFiltersCount}
            </Badge>
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <FiltersBody {...props} />
      </div>
    </div>
  );
}
