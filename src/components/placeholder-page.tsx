import { EmptyState } from "@/components/empty-state";
import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
}

export function PlaceholderPage({ title, subtitle, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>
      </header>
      <EmptyState icon={Icon ? <Icon className="h-5 w-5" /> : undefined} />
    </div>
  );
}
