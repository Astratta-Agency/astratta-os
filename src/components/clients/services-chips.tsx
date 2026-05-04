import { Badge } from "@/components/ui/badge";
import type { ProjectType } from "@/hooks/useClients";

const labels: Record<ProjectType, string> = {
  web_dev: "Web Dev",
  social_media: "Social Media",
  paid_ads: "Paid Ads",
  graphic_design: "Diseño",
  branding: "Branding",
  audit: "Auditoría",
};

export function ServicesChips({ projects }: { projects: { type: ProjectType }[] }) {
  const types = Array.from(new Set(projects.map((p) => p.type)));
  if (types.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((t) => (
        <Badge key={t} variant="secondary" className="text-xs font-medium">
          {labels[t]}
        </Badge>
      ))}
    </div>
  );
}
