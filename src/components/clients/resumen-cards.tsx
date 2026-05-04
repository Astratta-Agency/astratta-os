import { differenceInDays, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Star } from "lucide-react";
import type { ClientContact, ClientProject } from "@/hooks/useClientDetail";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function UpcomingDeliveries({ projects }: { projects: ClientProject[] }) {
  const today = new Date();
  const upcoming = projects
    .filter((p) => p.end_date && differenceInDays(new Date(p.end_date), today) >= -7)
    .filter((p) => p.end_date && differenceInDays(new Date(p.end_date), today) <= 60)
    .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Próximas entregas</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin entregas próximas en los próximos 60 días.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((p) => {
              const days = differenceInDays(new Date(p.end_date!), today);
              return (
                <li key={p.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(p.end_date!), "MMM d, yyyy")}
                      {p.budget_amount != null && ` · ${usd.format(Number(p.budget_amount))}`}
                    </div>
                  </div>
                  <Badge variant={days < 0 ? "destructive" : days <= 7 ? "default" : "secondary"}>
                    {days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? "Hoy" : `${days}d`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function StakeholdersList({ contacts }: { contacts: ClientContact[] }) {
  const sorted = [...contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stakeholders</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay contactos registrados.</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.is_primary && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Star className="h-3 w-3" /> Principal
                      </Badge>
                    )}
                  </div>
                  {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground">
                        <Mail className="h-3 w-3" /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
