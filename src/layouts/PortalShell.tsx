import { Outlet, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useClientPortalContext } from "@/hooks/portal/useClientPortalContext";
import { usePendingApprovals } from "@/hooks/portal/usePendingApprovals";
import { supabase } from "@/integrations/supabase/client";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function PortalShell() {
  const { slug } = useParams();
  const { data: ctx, isLoading, error } = useClientPortalContext(slug);
  const { data: pending = [] } = usePendingApprovals(ctx?.client.id);
  const [splashOpen, setSplashOpen] = useState(false);

  // Apply portal CSS vars + open splash for first-time invited users
  useEffect(() => {
    if (!ctx) return;
    const root = document.documentElement;
    root.style.setProperty("--portal-primary", ctx.client.brand_primary_color || "#5140f2");
    root.style.setProperty("--portal-secondary", ctx.client.brand_secondary_color || "#ff7503");
    if (ctx.currentClientUser.status === "invited" && !ctx.currentClientUser.accepted_at) {
      setSplashOpen(true);
    }
    return () => {
      root.style.removeProperty("--portal-primary");
      root.style.removeProperty("--portal-secondary");
    };
  }, [ctx]);

  const handleAccept = async () => {
    if (!ctx) return;
    await (supabase as any)
      .from("client_users")
      .update({ status: "active", accepted_at: new Date().toISOString() })
      .eq("id", ctx.currentClientUser.id);
    setSplashOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">No tienes acceso a este portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Si crees que es un error, contacta a tu agencia.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = pending.length;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <PortalSidebar client={ctx.client} pendingCount={pendingCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader client={ctx.client} />
        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet context={ctx} />
          </div>
        </main>
        <footer className="border-t border-border px-6 py-3 text-center text-[11px] text-muted-foreground">
          Powered by{" "}
          <a
            href="https://astrattaagency.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold hover:underline"
          >
            Astratta Agency
          </a>
        </footer>
      </div>

      <Dialog open={splashOpen} onOpenChange={(open) => { if (!open) return; setSplashOpen(open); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: "var(--portal-primary)" }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-center font-display text-xl">
              Bienvenida al portal de {ctx.client.name}
            </DialogTitle>
            <DialogDescription className="text-center">
              Tu equipo en Astratta Agency te invitó a colaborar. Aquí podrás aprobar contenido,
              ver reportes y acceder a tus documentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleAccept} className="w-full" style={{ backgroundColor: "var(--portal-primary)" }}>
              Empezar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
