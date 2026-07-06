import { useOutletContext, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Clock, CalendarClock, Briefcase, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useClientPortalKpis } from "@/hooks/portal/useClientPortalKpis";
import { usePendingApprovals, useApprovalsByStatus } from "@/hooks/portal/usePendingApprovals";
import { useClientTeam } from "@/hooks/portal/useClientTeam";
import { useMyProfile } from "@/hooks/useMyProfile";
import { ChannelIcon } from "@/components/calendar/channel-icon";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function ClientHome() {
  const ctx = useOutletContext<PortalContext>();
  const { user } = useAuth();
  const { client } = ctx;

  const { data: kpis } = useClientPortalKpis(client.id);
  const { data: pending = [] } = usePendingApprovals(client.id);
  const { data: upcoming = [] } = useApprovalsByStatus(client.id, ["approved", "scheduled"]);
  const { data: team = [] } = useClientTeam(client.workspace_id);
  const { data: profile } = useMyProfile();

  const firstName =
    profile?.first_name ||
    profile?.full_name?.split(" ")[0] ||
    (user?.user_metadata?.first_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";

  const base = `/portal/${client.slug}`;
  const pendingCount = kpis?.pendingApprovals ?? pending.length;

  return (
    <div className="space-y-8">
      {/* Greeting banner */}
      <div
        className="relative overflow-hidden rounded-xl p-8 text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--portal-primary) 0%, var(--portal-secondary) 100%)",
        }}
      >
        <h1 className="font-display text-3xl font-bold">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Aquí ves todo el trabajo que tu equipo en Astratta está haciendo para {client.name}.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Posts publicados este mes" value={kpis?.publishedThisMonth ?? 0} icon={CheckCircle2} />
        <Link to={`${base}/aprobaciones`}>
          <KpiCard
            label="Aprobaciones pendientes"
            value={pendingCount}
            icon={Clock}
            highlight={pendingCount > 0}
          />
        </Link>
        <KpiCard
          label="Próximo post programado"
          value={
            kpis?.nextScheduledPost
              ? formatDistanceToNow(new Date(kpis.nextScheduledPost.scheduled_for), { locale: es, addSuffix: true })
              : "—"
          }
          icon={CalendarClock}
          small
        />
        <KpiCard
          label="Próxima entrega"
          value={
            kpis?.nextProjectDeadline
              ? formatDistanceToNow(new Date(kpis.nextProjectDeadline.end_date), { locale: es, addSuffix: true })
              : "—"
          }
          subValue={kpis?.nextProjectDeadline?.name}
          icon={Briefcase}
          small
        />
      </div>

      {/* Pending action */}
      {pendingCount > 0 && (
        <Card style={{ borderColor: "var(--portal-primary)" }}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                Tienes {pendingCount} post{pendingCount === 1 ? "" : "s"} esperando tu aprobación
              </span>
              <Button asChild size="sm" style={{ backgroundColor: "var(--portal-primary)" }}>
                <Link to={`${base}/aprobaciones`}>
                  Revisar contenido <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {pending.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="flex gap-0.5">
                    {p.channels.slice(0, 3).map((c) => (
                      <ChannelIcon key={c} channel={c} size="sm" className="h-3.5 w-3.5 text-muted-foreground" />
                    ))}
                  </div>
                  <p className="line-clamp-1 flex-1 text-sm">
                    {(p.caption || p.title || "Sin caption").slice(0, 60)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {p.scheduled_for
                      ? formatDistanceToNow(new Date(p.scheduled_for), { locale: es, addSuffix: true })
                      : "Sin fecha"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Upcoming posts */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Próximos posts</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay posts programados.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.slice(0, 8).map((p) => (
              <div key={p.id} className="w-56 shrink-0 rounded-md border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1">
                  {p.channels.slice(0, 3).map((c) => (
                    <ChannelIcon key={c} channel={c} size="sm" className="h-3.5 w-3.5 text-muted-foreground" />
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {p.scheduled_for
                      ? formatDistanceToNow(new Date(p.scheduled_for), { locale: es, addSuffix: true })
                      : ""}
                  </span>
                </div>
                {p.media_urls[0] && (
                  <img src={p.media_urls[0]} alt="" className="mb-2 aspect-square w-full rounded object-cover" loading="lazy" />
                )}
                <p className="line-clamp-2 text-xs">{p.caption || p.title}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Tu equipo en Astratta</h2>
        <Card>
          <CardContent className="pt-6">
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tu equipo aparecerá aquí pronto.</p>
            ) : (
              <ul className="divide-y divide-border">
                {team.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 py-3">
                    <Avatar className="h-9 w-9">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ""} />}
                      <AvatarFallback className="bg-muted text-xs">
                        {(m.full_name ?? m.email ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.full_name ?? m.email}</p>
                      <p className="truncate text-xs text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                    </div>
                    {m.email && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`mailto:${m.email}`}>Contactar</a>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  highlight,
  small,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <Card
      className="h-full transition-shadow hover:shadow-md"
      style={
        highlight
          ? {
              borderColor: "var(--portal-primary)",
              backgroundColor: "color-mix(in srgb, var(--portal-primary) 8%, transparent)",
            }
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className={small ? "text-base font-semibold" : "font-display text-2xl font-bold"}>{value}</p>
        {subValue && <p className="line-clamp-1 text-[11px] text-muted-foreground">{subValue}</p>}
      </CardContent>
    </Card>
  );
}
