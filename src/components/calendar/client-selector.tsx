import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ClientLogo } from "@/components/clients/client-logo";
import { cn } from "@/lib/utils";

export type ClientOption = {
  id: string;
  name: string;
  logo_url?: string | null;
  brand_primary_color?: string | null;
};

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  options: ClientOption[];
}

export function ClientSelector({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 min-w-[200px] justify-between gap-2 px-3">
          {current ? (
            <span className="flex items-center gap-2 truncate">
              <ClientLogo
                name={current.name}
                logoUrl={current.logo_url}
                brandColor={current.brand_primary_color}
                size="sm"
                className="h-6 w-6"
              />
              <span className="truncate text-sm">{current.name}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Selecciona cliente</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Sin clientes</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <ClientLogo
                    name={o.name}
                    logoUrl={o.logo_url}
                    brandColor={o.brand_primary_color}
                    size="sm"
                    className="h-6 w-6"
                  />
                  <span className="flex-1 truncate">{o.name}</span>
                  <Check className={cn("h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
