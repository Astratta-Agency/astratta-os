import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ClientsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2 className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-xl font-bold text-foreground">Aún no tienes clientes</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Crea tu primer cliente para empezar a operar.
        </p>
      </div>
      <Button onClick={onCreate} className="gap-2">
        <Plus className="h-4 w-4" /> Nuevo cliente
      </Button>
    </Card>
  );
}
