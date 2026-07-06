import { Link } from "react-router-dom";
import { ClientLogo } from "@/components/clients/client-logo";
import { UserMenu } from "@/components/user-menu";
import type { PortalClient } from "@/hooks/portal/useClientPortalContext";

interface Props {
  client: PortalClient;
}

export function PortalHeader({ client }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Link to={`/portal/${client.slug}`} className="flex items-center gap-3">
        <ClientLogo
          name={client.name}
          logoUrl={client.logo_url}
          brandColor={client.brand_primary_color}
          size="sm"
        />
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-foreground">{client.name}</p>
          <p className="text-[10px] text-muted-foreground">
            Portal · Powered by Astratta Agency
          </p>
        </div>
      </Link>
      <div className="flex-1" />
      <UserMenu profilePath={`/portal/${client.slug}/perfil`} loginPath="/portal/login" />
    </header>
  );
}
