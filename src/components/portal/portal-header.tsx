import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu } from "lucide-react";
import { ClientLogo } from "@/components/clients/client-logo";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PortalNavLinks, PortalContactFooter } from "@/components/portal/portal-sidebar";
import type { PortalClient } from "@/hooks/portal/useClientPortalContext";

interface Props {
  client: PortalClient;
  pendingCount: number;
}

export function PortalHeader({ client, pendingCount }: Props) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      {/* Mobile-only menu toggle — the sidebar (portal-sidebar.tsx) is hidden below md */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="flex w-64 flex-col p-0 md:hidden">
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle className="font-display text-sm font-bold">{client.name}</SheetTitle>
          </SheetHeader>
          <PortalNavLinks client={client} pendingCount={pendingCount} onNavigate={() => setNavOpen(false)} />
          <PortalContactFooter />
        </SheetContent>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          onClick={() => setNavOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </Sheet>

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
            Portal · Powered by Astratta OS
          </p>
        </div>
      </Link>
      <div className="flex-1" />
      <UserMenu profilePath={`/portal/${client.slug}/perfil`} loginPath="/portal/login" />
    </header>
  );
}
