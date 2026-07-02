import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_TYPES, PROJECT_TYPE_LABEL } from "@/components/projects/project-meta";
import { useWorkspaceDetail, type WorkspaceService } from "@/hooks/useWorkspaceSettings";

interface Props {
  workspaceId: string | undefined;
  value: string | null; // service_id or "custom" or null
  onChange: (v: { service: WorkspaceService | null; custom: boolean }) => void;
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}

/** Reusable Select of services grouped by project-type category. */
export function ServiceCatalogSelect({
  workspaceId,
  value,
  onChange,
  placeholder = "Seleccioná un servicio",
  allowCustom = false,
  className,
}: Props) {
  const { data: ws } = useWorkspaceDetail(workspaceId);
  const services = ws?.services ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceService[]>();
    for (const s of services) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return map;
  }, [services]);

  const handleChange = (v: string) => {
    if (v === "__custom__") return onChange({ service: null, custom: true });
    const svc = services.find((s) => s.id === v) ?? null;
    onChange({ service: svc, custom: false });
  };

  return (
    <Select value={value ?? undefined} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {services.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Aún no cargaste servicios en Configuración.
          </div>
        )}
        {PROJECT_TYPES.map((cat) => {
          const list = grouped.get(cat) ?? [];
          if (list.length === 0) return null;
          return (
            <SelectGroup key={cat}>
              <SelectLabel>{PROJECT_TYPE_LABEL[cat]}</SelectLabel>
              {list.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || "(sin nombre)"}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
        {allowCustom && (
          <SelectGroup>
            <SelectLabel>Otro</SelectLabel>
            <SelectItem value="__custom__">Personalizado…</SelectItem>
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
