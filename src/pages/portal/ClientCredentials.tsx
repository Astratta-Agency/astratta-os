import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Info,
  Instagram,
  KeyRound,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import type { PortalContext } from "@/hooks/portal/useClientPortalContext";
import {
  useClientCredentials,
  useRevealCredential,
  type ClientCredential,
  type CredentialCategory,
} from "@/hooks/useClientCredentials";

const CATEGORY_LABEL: Record<CredentialCategory, string> = {
  social_media: "Redes sociales",
  analytics: "Analytics",
  hosting_domain_cms: "Hosting / Dominio / CMS",
  tool_other: "Otras herramientas",
};

const CATEGORY_ORDER: CredentialCategory[] = [
  "social_media",
  "analytics",
  "hosting_domain_cms",
  "tool_other",
];

function CategoryIcon({
  category,
  className,
}: {
  category: CredentialCategory;
  className?: string;
}) {
  const cls = className ?? "h-4 w-4";
  switch (category) {
    case "social_media":
      return <Instagram className={cls} />;
    case "analytics":
      return <BarChart3 className={cls} />;
    case "hosting_domain_cms":
      return <Globe className={cls} />;
    case "tool_other":
    default:
      return <KeyRound className={cls} />;
  }
}

export default function ClientCredentials() {
  const ctx = useOutletContext<PortalContext>();
  const clientId = ctx.client.id;
  const isAdmin = ctx.role === "client_admin";
  const { data: credentials, isLoading } = useClientCredentials(clientId);

  const grouped = useMemo(() => {
    const map = new Map<CredentialCategory, ClientCredential[]>();
    for (const c of credentials ?? []) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [credentials]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Credenciales</h1>
        <p className="text-sm text-muted-foreground">
          Accesos que tu agencia utiliza para gestionar tus canales digitales.
        </p>
      </header>

      {!isAdmin && (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--portal-primary) 30%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--portal-primary) 6%, transparent)",
          }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--portal-primary)" }} />
          <span className="text-muted-foreground">
            Tu rol de <strong>Viewer</strong> te permite ver qué accesos existen, pero no revelar
            las contraseñas. Solo un administrador de la cuenta puede hacerlo.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (credentials?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--portal-primary) 12%, transparent)",
              }}
            >
              <Lock className="h-6 w-6" style={{ color: "var(--portal-primary)" }} />
            </div>
            <p className="font-medium text-foreground">Aún no hay credenciales cargadas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu agencia todavía no cargó accesos para tu cuenta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle
                    className="flex items-center gap-2 text-base"
                    style={{ color: "var(--portal-primary)" }}
                  >
                    <CategoryIcon category={cat} /> {CATEGORY_LABEL[cat]}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {items.map((c) => (
                      <li key={c.id} className="px-4 py-3">
                        <CredentialRow credential={c} isAdmin={isAdmin} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  credential,
  isAdmin,
}: {
  credential: ClientCredential;
  isAdmin: boolean;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const reveal = useRevealCredential();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleReveal = async () => {
    try {
      const value = await reveal.mutateAsync(credential.id);
      setRevealed(value);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setRevealed(null), 20_000);
    } catch (e: any) {
      toast({
        title: "No se pudo revelar la contraseña",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    try {
      // Fetch a fresh value via RPC (also registers an access event).
      const value = await reveal.mutateAsync(credential.id);
      await navigator.clipboard.writeText(value);
      toast({ title: "Copiado al portapapeles" });
    } catch (e: any) {
      toast({
        title: "No se pudo copiar",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-foreground">{credential.label}</span>
          {credential.login_url && (
            <a
              href={credential.login_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline"
              style={{ color: "var(--portal-primary)" }}
            >
              <ExternalLink className="h-3 w-3" /> Abrir
            </a>
          )}
        </div>
        {credential.username && (
          <div className="truncate text-xs text-muted-foreground">{credential.username}</div>
        )}
        {credential.notes && (
          <div className="line-clamp-2 text-xs text-muted-foreground">{credential.notes}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 font-mono text-sm">
          {revealed ? revealed : "••••••••"}
        </div>
        {isAdmin ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={revealed ? () => setRevealed(null) : handleReveal}
              disabled={reveal.isPending}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealed ? "Ocultar" : "Revelar"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={reveal.isPending}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Restringido
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Solo un administrador de la cuenta puede ver esta contraseña.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
