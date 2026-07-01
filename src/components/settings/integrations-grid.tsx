import {
  Megaphone,
  Chrome,
  Linkedin,
  Video,
  CreditCard,
  FileSignature,
  MessageSquare,
  Zap,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
};

const INTEGRATIONS: Integration[] = [
  { id: "meta", name: "Meta Business Suite", description: "Publica y sincroniza Instagram y Facebook", icon: Megaphone },
  { id: "google", name: "Google", description: "Ads, Analytics, Search Console y Drive", icon: Chrome },
  { id: "linkedin", name: "LinkedIn", description: "Publicación y métricas de LinkedIn", icon: Linkedin },
  { id: "tiktok", name: "TikTok Business", description: "Publicación y métricas de TikTok", icon: Video },
  { id: "stripe", name: "Stripe", description: "Cobros y suscripciones", icon: CreditCard },
  { id: "docusign", name: "DocuSign", description: "Firma de contratos y propuestas", icon: FileSignature },
  { id: "slack", name: "Slack", description: "Notificaciones internas del equipo", icon: MessageSquare },
  { id: "zapier", name: "Zapier / Make", description: "Automatizaciones vía webhooks", icon: Zap },
  { id: "calendly", name: "Calendly", description: "Agendar diagnósticos con prospectos", icon: CalendarClock },
];

export function IntegrationsGrid() {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => {
          const Icon = i.icon;
          return (
            <Card key={i.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary">No conectado</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{i.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-block">
                      <Button variant="outline" size="sm" disabled className="pointer-events-none">
                        Conectar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Próximamente</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
