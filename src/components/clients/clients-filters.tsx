import { LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ClientStatus } from "@/hooks/useClients";

export const INDUSTRIES = [
  "Med Spa",
  "Healthcare",
  "Wellness",
  "Retail",
  "Industrial",
  "Servicios Profesionales",
  "Restaurante",
  "Real Estate",
  "Otro",
];

export const LOCATIONS = ["Dallas-Fort Worth, TX", "Houston, TX", "Austin, TX", "Otro"];

export type ViewMode = "table" | "cards";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: ClientStatus | "all";
  onStatus: (v: ClientStatus | "all") => void;
  industry: string;
  onIndustry: (v: string) => void;
  location: string;
  onLocation: (v: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
}

export function ClientsFilters(p: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente…"
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={p.industry} onValueChange={p.onIndustry}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Industria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las industrias</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p.status} onValueChange={(v) => p.onStatus(v as ClientStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="prospect">Prospectos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
          </SelectContent>
        </Select>

        <Select value={p.location} onValueChange={p.onLocation}>
          <SelectTrigger className="w-[200px]">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Ubicación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {LOCATIONS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        type="single"
        value={p.view}
        onValueChange={(v) => v && p.onView(v as ViewMode)}
        className="self-start md:self-auto"
      >
        <ToggleGroupItem value="table" aria-label="Vista tabla">
          <List className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="cards" aria-label="Vista tarjetas">
          <LayoutGrid className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
