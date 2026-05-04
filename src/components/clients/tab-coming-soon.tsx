import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function TabComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Construction className="h-8 w-8 text-muted-foreground" />
        <div className="font-display text-lg font-semibold text-foreground">{title}</div>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
