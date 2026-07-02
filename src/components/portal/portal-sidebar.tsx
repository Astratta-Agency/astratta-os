import { NavLink } from "react-router-dom";
import {
  Home,
  CheckSquare,
  CalendarDays,
  FileText,
  BarChart3,
  ImagePlus,
  Lock,
  Mail,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PortalClient } from "@/hooks/portal/useClientPortalContext";

interface Props {
  client: PortalClient;
  pendingCount: number;
}

export function PortalSidebar({ client, pendingCount }: Props) {
  const base = `/portal/${client.slug}`;
  const items = [
    { to: base, label: "Inicio", icon: Home, end: true },
    { to: `${base}/aprobaciones`, label: "Aprobaciones", icon: CheckSquare, badge: pendingCount },
    { to: `${base}/calendario`, label: "Calendario", icon: CalendarDays },
    { to: `${base}/pagos`, label: "Pagos", icon: Wallet },
    { to: `${base}/documentos`, label: "Documentos", icon: FileText },
    { to: `${base}/reportes`, label: "Reportes", icon: BarChart3 },
    { to: `${base}/activos`, label: "Activos", icon: ImagePlus },
    { to: `${base}/credenciales`, label: "Credenciales", icon: Lock },
  ];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <nav className="flex-1 space-y-1 p-3 pt-6">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
            style={({ isActive }) =>
              isActive
                ? {
                    backgroundColor: "color-mix(in srgb, var(--portal-primary) 8%, transparent)",
                    boxShadow: "inset 3px 0 0 0 var(--portal-primary)",
                  }
                : undefined
            }
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px]" variant="destructive">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <a
          href="mailto:hola@astrattaagency.com"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
          Contactar mi equipo
        </a>
      </div>
    </aside>
  );
}
