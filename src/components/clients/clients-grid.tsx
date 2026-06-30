import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ClientLogo } from "./client-logo";
import { HealthScoreBar } from "./health-score-bar";
import { StatusBadge } from "./status-badge";
import { ServicesChips } from "./services-chips";
import { type ClientRow } from "@/hooks/useClients";

export function ClientsGrid({ clients }: { clients: ClientRow[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => (
          <Card
            key={c.id}
            className="cursor-pointer p-5 transition-shadow hover:shadow-md"
            onClick={() => navigate(`/app/clientes/${c.slug}`)}
          >
            <div className="flex items-start gap-4">
              <ClientLogo
                name={c.name}
                logoUrl={c.logo_url}
                brandColor={c.brand_primary_color}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display truncate text-base font-bold text-foreground">
                    {c.name}
                  </h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.industry ?? "—"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <ServicesChips projects={c.projects ?? []} />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Health Score</p>
                <HealthScoreBar score={c.health_score} />
              </div>
            </div>
          </Card>
      ))}
    </div>
  );
}
