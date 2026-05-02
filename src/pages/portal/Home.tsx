import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
export default function PortalHome() {
  return (
    <PlaceholderPage
      title="Portal de cliente"
      subtitle="Aquí verás tus contenidos para aprobar, reportes y documentos."
      icon={LayoutDashboard}
    />
  );
}
