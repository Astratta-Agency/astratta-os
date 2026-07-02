import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgencyAnalyticsTab } from "@/components/analytics/agency-analytics-tab";
import { TabComingSoon } from "@/components/clients/tab-coming-soon";

export default function Reportes() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Analytics de la agencia y reportes por cliente
        </p>
      </header>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Analytics agencia</TabsTrigger>
          <TabsTrigger value="clientes">Reportes de cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AgencyAnalyticsTab />
        </TabsContent>

        <TabsContent value="clientes">
          <TabComingSoon
            title="Reportes mensuales por cliente"
            description="Generación de reportes PDF por cliente con métricas de performance del mes. Próximamente."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
