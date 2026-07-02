import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgencyAnalyticsTab } from "@/components/analytics/agency-analytics-tab";
import { ClientReportsTab } from "@/components/analytics/client-reports-tab";

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
          <ClientReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
