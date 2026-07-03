import { format, addMonths, addWeeks, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalView = "mes" | "semana" | "lista" | "canal" | "kanban";

interface Props {
  date: Date;
  view: CalView;
  onChange: (d: Date) => void;
}

export function CalendarNavigator({ date, view, onChange }: Props) {
  const step = (dir: 1 | -1) => {
    if (view === "mes") onChange(addMonths(date, dir));
    else onChange(addWeeks(date, dir));
  };

  const label = (() => {
    if (view === "mes") {
      const s = format(date, "LLLL yyyy", { locale: es });
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    const s = startOfWeek(date, { weekStartsOn: 0 });
    const e = endOfWeek(date, { weekStartsOn: 0 });
    return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM yyyy", { locale: es })}`;
  })();

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => step(-1)} className="h-9 w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(new Date())} className="h-9">
        Hoy
      </Button>
      <Button variant="outline" size="icon" onClick={() => step(1)} className="h-9 w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span className="ml-3 min-w-[180px] text-sm font-medium">{label}</span>
    </div>
  );
}
