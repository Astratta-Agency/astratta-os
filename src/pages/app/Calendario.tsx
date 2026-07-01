import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  parseISO,
  isValid,
} from "date-fns";
import { Plus, CalendarPlus, Settings2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useClients } from "@/hooks/useClients";
import {
  useContentPillars,
  useCreatePost,
  useSocialPosts,
  useUpdatePostSchedule,
  useUpdatePostStatus,
} from "@/hooks/useSocialPosts";
import type { Channel, PostStatus } from "@/lib/post-states";

import { ClientSelector } from "@/components/calendar/client-selector";
import { CalendarNavigator, type CalView } from "@/components/calendar/calendar-navigator";
import { CalendarFiltersBar } from "@/components/calendar/calendar-filters-bar";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CalendarListView } from "@/components/calendar/calendar-list-view";
import { CalendarChannelView } from "@/components/calendar/calendar-channel-view";
import { PostEditorPanel } from "@/components/calendar/editor/post-editor-panel";
import { PostQuickCreateDialog } from "@/components/calendar/post-quick-create-dialog";
import { ManagePillarsDialog } from "@/components/calendar/manage-pillars-dialog";


const parseList = (v: string | null): string[] => (v ? v.split(",").filter(Boolean) : []);

const LS_KEY = "calendario:last_client_id";

export default function Calendario() {
  const { workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;

  const [params, setParams] = useSearchParams();

  const view = (params.get("view") as CalView) || "mes";
  const clientIdParam = params.get("client_id");
  const search = params.get("q") ?? "";
  const channels = parseList(params.get("channels")) as Channel[];
  const statuses = parseList(params.get("status")) as PostStatus[];
  const pillars = parseList(params.get("pillars"));
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

  // Clients
  const { data: clients = [], isLoading: clientsLoading } = useClients(workspaceId, {
    search: "",
    status: "all",
    industry: "all",
    location: "all",
  });
  const activeClients = clients.filter((c) => c.status === "active" || c.status === "prospect");

  // Resolve active clientId
  const [clientId, setClientIdState] = useState<string | null>(clientIdParam);
  useEffect(() => {
    if (clientIdParam) {
      setClientIdState(clientIdParam);
      return;
    }
    if (activeClients.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    const valid = stored && activeClients.find((c) => c.id === stored) ? stored : activeClients[0].id;
    setClientIdState(valid);
    update({ client_id: valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIdParam, activeClients.length]);

  const setClientId = (id: string) => {
    setClientIdState(id);
    try {
      window.localStorage.setItem(LS_KEY, id);
    } catch {}
    update({ client_id: id });
  };

  // Date range from view + anchor
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
    // list — current month wide window
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [view, anchor]);

  const [debouncedSearch] = useDebounce(search, 300);

  const { data: posts = [], isLoading: postsLoading } = useSocialPosts({
    workspaceId,
    clientId: clientId ?? undefined,
    range,
    filters: { channels, statuses, pillars, search: debouncedSearch },
  });

  const { data: pillarOptions = [] } = useContentPillars(clientId ?? undefined);
  const pillarMap = useMemo(() => {
    const m = new Map<string, any>();
    pillarOptions.forEach((p) => m.set(p.name, p));
    return m;
  }, [pillarOptions]);

  const updateSchedule = useUpdatePostSchedule();
  const updateStatus = useUpdatePostStatus();
  const createPost = useCreatePost();

  const postIdParam = params.get("post");
  const [editorOpen, setEditorOpen] = useState<boolean>(!!postIdParam);
  useEffect(() => {
    setEditorOpen(!!postIdParam);
  }, [postIdParam]);
  const openPost = (id: string) => update({ post: id });
  const closeEditor = () => {
    setEditorOpen(false);
    update({ post: null });
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [pillarsOpen, setPillarsOpen] = useState(false);

  const activeFiltersCount =
    (channels.length ? 1 : 0) +
    (statuses.length ? 1 : 0) +
    (pillars.length ? 1 : 0) +
    (search ? 1 : 0);

  const clearFilters = () => update({ q: null, channels: null, status: null, pillars: null });

  // Keyboard shortcut: "N" opens quick create
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setCreateDate(null);
      setCreateOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleReschedule = async (postId: string, newDate: Date) => {
    try {
      await updateSchedule.mutateAsync({ id: postId, scheduled_for: newDate.toISOString() });
    } catch (e: any) {
      toast.error("No se pudo reprogramar", { description: e?.message });
    }
  };

  const handleStatusChange = async (
    postId: string,
    from: PostStatus,
    to: PostStatus,
    clientIdArg: string,
  ) => {
    try {
      await updateStatus.mutateAsync({ id: postId, clientId: clientIdArg, from, to });
      toast.success(`Movido a ${to}`);
    } catch (e: any) {
      toast.error("No se pudo actualizar el estado", { description: e?.message });
      throw e;
    }
  };

  const openCreate = (date?: Date | null) => {
    setCreateDate(date ?? null);
    setCreateOpen(true);
  };

  const handleCreate = async (input: {
    caption: string;
    scheduled_for: Date;
    channels: Channel[];
    content_pillar: string | null;
    status: PostStatus;
  }) => {
    if (!workspaceId || !clientId) return;
    try {
      await createPost.mutateAsync({
        workspaceId,
        clientId,
        caption: input.caption,
        scheduled_for: input.scheduled_for.toISOString(),
        channels: input.channels,
        content_pillar: input.content_pillar,
        status: input.status,
      });
      toast.success("Publicación creada");
      setCreateOpen(false);
    } catch (e: any) {
      toast.error("No se pudo crear la publicación", { description: e?.message });
    }
  };

  // Empty workspace state
  if (!clientsLoading && activeClients.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendario</h1>
          <p className="text-sm text-muted-foreground">Planifica y programa contenido</p>
        </header>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CalendarPlus className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aún no hay clientes activos</p>
          <p className="mt-1 text-sm text-muted-foreground">Crea un cliente para empezar a planificar contenido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendario</h1>
            <p className="text-sm text-muted-foreground">Planifica y programa contenido</p>
          </div>
          <Button onClick={() => openCreate(null)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva publicación
          </Button>
        </div>

        <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg border bg-background/90 p-2 backdrop-blur md:flex-row md:items-center md:gap-3">
          <ClientSelector
            value={clientId}
            onChange={setClientId}
            options={activeClients.map((c) => ({
              id: c.id,
              name: c.name,
              logo_url: c.logo_url,
              brand_primary_color: c.brand_primary_color,
            }))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPillarsOpen(true)}
            disabled={!clientId}
            title="Gestionar pilares"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Pilares
          </Button>
          <CalendarNavigator
            date={anchor}
            view={view}
            onChange={(d) => update({ anchor: d.toISOString() })}
          />
          <div className="ml-auto inline-flex rounded-md border">
            {(["mes", "semana", "lista", "canal"] as CalView[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                onClick={() => update({ view: v === "mes" ? null : v })}
                className="capitalize"
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <CalendarFiltersBar
        search={search}
        onSearch={(v) => update({ q: v })}
        channels={channels}
        onChannels={(v) => update({ channels: v })}
        pillars={pillars}
        onPillars={(v) => update({ pillars: v })}
        pillarOptions={pillarOptions}
        statuses={statuses}
        onStatuses={(v) => update({ status: v })}
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
      />

      {postsLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CalendarPlus className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aún no hay publicaciones para este período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea la primera para empezar a planificar
          </p>
          <Button className="mt-4" onClick={() => openCreate(null)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva publicación
          </Button>
        </div>
      ) : view === "mes" ? (
        <CalendarMonthView
          monthAnchor={anchor}
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => openPost(p.id)}
          onCreate={openCreate}
          onReschedule={handleReschedule}
        />
      ) : view === "semana" ? (
        <CalendarWeekView
          anchor={anchor}
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => openPost(p.id)}
          onCreate={openCreate}
          onReschedule={handleReschedule}
        />
      ) : view === "canal" ? (
        <CalendarChannelView
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => openPost(p.id)}
        />
      ) : (
        <CalendarListView
          posts={posts}
          pillarMap={pillarMap}
          onPostClick={(p) => openPost(p.id)}
          clientName={activeClients.find((c) => c.id === clientId)?.name}
          rangeFrom={range.from}
          rangeTo={range.to}
        />
      )}

      <PostEditorPanel
        postId={postIdParam}
        open={editorOpen}
        onOpenChange={(o) => (o ? setEditorOpen(true) : closeEditor())}
        clients={clients}
        workspaceId={workspaceId ?? ""}
        onChangeStatus={handleStatusChange}
      />



      <PostQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createDate}
        pillarOptions={pillarOptions}
        submitting={createPost.isPending}
        onSubmit={handleCreate}
      />

      <ManagePillarsDialog
        clientId={clientId}
        open={pillarsOpen}
        onOpenChange={setPillarsOpen}
      />
    </div>
  );
}
