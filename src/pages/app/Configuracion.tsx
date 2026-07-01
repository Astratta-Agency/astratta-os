import { Settings, Info } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useUserContext } from "@/hooks/useUserContext";
import { WorkspaceBrandingCard } from "@/components/settings/workspace-branding-card";
import { WorkspacePillarsCard } from "@/components/settings/workspace-pillars-card";
import { WorkspaceTemplatesCard } from "@/components/settings/workspace-templates-card";
import { WorkspaceServicesCard } from "@/components/settings/workspace-services-card";
import { IntegrationsGrid } from "@/components/settings/integrations-grid";
import { NotificationPreferencesCard } from "@/components/settings/notification-preferences-card";

export default function Configuracion() {
  const { workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: ctx } = useUserContext();
  const membership = ctx?.workspaces?.find((w) => w.workspace_id === workspace?.id);
  const isOwner = membership?.role === "owner";

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Configuración</h1>
          <p className="mt-1 text-base text-muted-foreground">Preferencias del workspace</p>
        </div>
      </header>

      {wsLoading || !workspace ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="workspace">
          <TabsList>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
            <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-4 pt-2">
            {!isOwner && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Solo el propietario del workspace puede editar esta información — la estás viendo
                  en modo lectura.
                </AlertDescription>
              </Alert>
            )}
            <WorkspaceBrandingCard workspaceId={workspace.id} isOwner={!!isOwner} />
            <WorkspacePillarsCard workspaceId={workspace.id} isOwner={!!isOwner} />
            <WorkspaceTemplatesCard workspaceId={workspace.id} isOwner={!!isOwner} />
            <WorkspaceServicesCard workspaceId={workspace.id} isOwner={!!isOwner} />
          </TabsContent>

          <TabsContent value="integraciones" className="pt-2">
            <IntegrationsGrid />
          </TabsContent>

          <TabsContent value="notificaciones" className="pt-2">
            <NotificationPreferencesCard workspaceId={workspace.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
