import { Globe, Instagram, Target, Palette, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL } from "@/components/projects/project-meta";
import type { ProjectType } from "@/integrations/supabase/database.types";

const ICONS: Record<ProjectType, React.ComponentType<{ className?: string }>> = {
  web_dev: Globe,
  social_media: Instagram,
  paid_ads: Target,
  graphic_design: Palette,
  branding: Sparkles,
  audit: Search,
};

const DESCRIPTIONS: Record<ProjectType, string> = {
  web_dev: "Sitios y aplicaciones web",
  social_media: "Gestión de redes y contenido",
  paid_ads: "Campañas pagadas multi-canal",
  graphic_design: "Piezas gráficas y assets",
  branding: "Identidad y manual de marca",
  audit: "Auditorías y diagnósticos",
};

interface Props {
  value: ProjectType | null;
  onChange: (v: ProjectType) => void;
}

export function ProjectTypeSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {PROJECT_TYPES.map((t) => {
        const Icon = ICONS[t];
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/60",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
              )}
            />
            <div>
              <p className="text-sm font-medium">{PROJECT_TYPE_LABEL[t]}</p>
              <p className="text-xs text-muted-foreground">{DESCRIPTIONS[t]}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
