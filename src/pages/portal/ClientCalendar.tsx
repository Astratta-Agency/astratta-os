import { useEffect, useMemo } from "react";
import { useOutletContext, useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  endOfMonth,
  endOfWeek,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useSocialPosts } from "@/hooks/useSocialPosts";
import { useContentPillars } from "@/hooks/useSocialPosts";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";
import type { Channel, PostStatus } from "@/lib/post-states";

import { CalendarNavigator, type CalView } from "@/components/calendar/calendar-navigator";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CalendarListView } from "@/components/calendar/calendar-list-view";
import {
  PortalCalendarFiltersBar,
  PORTAL_VISIBLE_STATUSES,
} from "@/components/portal/calendar/portal-calendar-filters-bar";

const parseList = (v: string | null): string[] => (v ? v.split(",").filter(Boolean) : []);

type PortalView = Extract<CalView, "mes" | "semana" | "lista">;
const ALLOWED_VIEWS: PortalView[] = ["mes", "semana", "lista"];

export default function ClientCalendar() {
  const ctx = useOutletContext<PortalContext>();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const viewParam = params.get("view") as PortalView | null;
  const view: PortalView = viewParam && ALLOWED_VIEWS.includes(viewParam) ? viewParam : "mes";
  const channels = parseList(params.get("channels")) as Channel[];
  const rawStatuses = parseList(params.get("status")) as PostStatus[];
  // Never allow internal statuses through the URL
  const statuses = rawStatuses.filter((s) => PORTAL_VISIBLE_STATUSES.includes(s));

  const anchorRaw = params.get("anchor");
  const anchor = useMemo(() => {
    if (anchorRaw) {
      const d = parseISO(anchorRaw);
      if (isValid(d)) return d;
    }
    return new Date();
  }, [anchorRaw]);

  const update = (next: Record<string, string | string[] | null | undefined>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) p.delete(k);
      else if (Array.isArray(v)) p.set(k, v.join(","));
      else p.set(k, v);
    });
    setParams(p, { replace: true });
  };

  const range = useMemo(() => {
    if (view === "mes") {
      return {
        from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 }),
        to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }),
      };
    }
    if (view === "semana") {
      return {
        from: startOfWeek(anchor, { weekStartsOn: 0 }),
        to: endOfWeek(anchor, { weekStartsOn: 0 }),
      };
    }
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [view, anchor]);

  // Enforce portal-visible statuses: intersect selected with allowed;
  // if none selected, hook still restricted to allowed via effectiveStatuses.
  const effectiveStatuses = statuses.length > 0 ? statuses : PORTAL_VISIBLE_STATUSES;

  const { data: posts = [], isLoading: postsLoading } = useSocialPosts({
    workspaceId: ctx.client.workspace_id,
    clientId: ctx.client.id,
    range,
    filters: { channels, statuses: effectiveStatuses },
  });

  const { data: pillarOptions = [] } = useContentPillars(ctx.client.id);
  const pillarMap = useMemo(() => {
    const m = new Map<string, any>();
    pillarOptions.forEach((p) => m.set(p.name, p));
    return m;
  }, [pillarOptions]);

  // Mobile-first: if screen is small and default view is "mes", switch to "lista".
  useEffect(() => {
    if (viewParam) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 640px)").matches) {
      update({ view: "lista" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToApproval = (postId: string) => {
    navigate(`/portal/${slug}/aprobaciones?post=${postId}`);
  };

  const activeFiltersCount = (channels.length ? 1 : 0) + (statuses.length ? 1 : 0);
  const clearFilters = () => update({ channels: null, status: null });

  const noop = () => {};

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Contenido programado y aprobado para {ctx.client.name}
        </p>
      </header>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-2 md:flex-row md:items-center">
        <CalendarNavigator
          date={anchor}
          view={view}
          onChange={(d) => update({ anchor: d.toISOString() })}
        />
        <div className="md:ml-auto inline-flex rounded-md border">
          {ALLOWED_VIEWS.map((v) => (
            <Button
              key={v}
              variant={view === v ? "secondary" : "ghost"}
              size="sm"
              onClick={() => update({ view: v === "mes" ? null : v })}
              className="capitalize"
              style={
                view === v
                  ? { backgroundColor: "var(--portal-primary)", color: "white" }
                  : undefined
              }
            >
              {v}
            </Button>
          ))}
        </div>
      </div>

      <PortalCalendarFiltersBar
        channels={channels}
        onChannels={(v) => update({ channels: v })}
        statuses={statuses}
        onStatuses={(v) => update({ status: v })}
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
      />

      {postsLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24 md:h-32" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No hay contenido programado en este período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando tu agencia programe publicaciones, las verás acá.
          </p>
        </div>
      ) : view === "mes" ? (
        <CalendarMonthView
          monthAnchor={anchor}
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => goToApproval(p.id)}
          onCreate={noop}
          onReschedule={noop}
          readonly
        />
      ) : view === "semana" ? (
        <CalendarWeekView
          anchor={anchor}
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => goToApproval(p.id)}
          onCreate={noop}
          onReschedule={noop}
          readonly
        />
      ) : (
        <CalendarListView
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => goToApproval(p.id)}
          clientName={ctx.client.name}
          rangeFrom={range.from}
          rangeTo={range.to}
        />
      )}
    </div>
  );
}
