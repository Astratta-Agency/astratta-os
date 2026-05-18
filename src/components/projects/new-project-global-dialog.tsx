import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectTypeSelector } from "@/components/projects/project-type-selector";
import { PROJECT_TYPE_LABEL } from "@/components/projects/project-meta";
import { useWorkspaceMembers } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectType } from "@/integrations/supabase/database.types";

interface ClientOption {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  clients: ClientOption[];
  onCreateClient?: () => void;
}

export function NewProjectGlobalDialog({
  open,
  onOpenChange,
  workspaceId,
  clients,
  onCreateClient,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState<string>("");
  const [type, setType] = useState<ProjectType | null>(null);
  const [name, setName] = useState("");
  const [retainer, setRetainer] = useState(false);
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [applyTemplate, setApplyTemplate] = useState(true);
  const [clientCbOpen, setClientCbOpen] = useState(false);

  const reset = () => {
    setStep(1);
    setClientId("");
    setType(null);
    setName("");
    setRetainer(false);
    setBudget("");
    setStartDate(undefined);
    setEndDate(undefined);
    setTeamIds([]);
    setDescription("");
    setApplyTemplate(true);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const datesValid = !startDate || !endDate || endDate >= startDate;
  const step1Valid = !!clientId && !!type;
  const step2Valid = name.trim().length > 0 && name.length <= 120 && datesValid;
  const isSocial = type === "social_media";
  const maxStep = isSocial ? 3 : 2;

  const create = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !clientId || !type) throw new Error("Faltan datos");
      const payload: Record<string, unknown> = {
        workspace_id: workspaceId,
        client_id: clientId,
        name: name.trim(),
        type,
        status: "planning",
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        description: description.trim() || null,
        retainer_monthly: isSocial ? retainer : false,
        budget_amount: budget ? Number(budget) : null,
        assigned_team_ids: teamIds,
      };
      const { data, error } = await (supabase as any)
        .from("projects")
        .insert(payload)
        .select("id, client_id")
        .single();
      if (error) throw error;
      return data as { id: string; client_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-stats"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client"] });
    },
  });

  const handleSubmit = async () => {
    try {
      await create.mutateAsync();
      toast.success("Proyecto creado", { description: name });
      if (isSocial && applyTemplate) {
        toast("Plantilla aplicada (próximamente)");
      }
      const client = clients.find((c) => c.id === clientId);
      close();
      if (client) navigate(`/app/clientes/${client.slug}`);
    } catch (e: any) {
      toast.error("No se pudo crear el proyecto", { description: e?.message });
    }
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  );

  const toggleMember = (id: string) =>
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Paso {step} de {maxStep}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {Array.from({ length: maxStep }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition",
                i + 1 <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Popover open={clientCbOpen} onOpenChange={setClientCbOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selectedClient?.name ?? "Selecciona un cliente"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados</CommandEmpty>
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setClientId(c.id);
                              setClientCbOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                clientId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {onCreateClient && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setClientCbOpen(false);
                              onCreateClient();
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Crear cliente nuevo
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de proyecto *</Label>
              <ProjectTypeSelector value={type} onChange={setType} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Ej: Rediseño web Q3"
              />
            </div>

            {isSocial ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="retainer">Retainer mensual</Label>
                  <Switch id="retainer" checked={retainer} onCheckedChange={setRetainer} />
                </div>
                {retainer && (
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Monto mensual (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      min={0}
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="budget">Presupuesto (USD)</Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {startDate ? format(startDate, "PPP") : "Selecciona fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {endDate ? format(endDate, "PPP") : "Selecciona fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {!datesValid && (
                  <p className="text-xs text-destructive">Debe ser ≥ fecha de inicio</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Equipo asignado</Label>
              <div className="flex flex-wrap gap-2 rounded-md border p-2">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin miembros aún</p>
                )}
                {members.map((m) => {
                  const active = teamIds.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => toggleMember(m.user_id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/60",
                      )}
                    >
                      {m.full_name || m.email || m.user_id.slice(0, 6)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Brief / descripción</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Objetivos, contexto, links útiles..."
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {description.length}/500
              </p>
            </div>
          </div>
        )}

        {step === 3 && isSocial && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border p-4">
              <Checkbox
                id="tpl"
                checked={applyTemplate}
                onCheckedChange={(v) => setApplyTemplate(!!v)}
              />
              <div className="space-y-1">
                <Label htmlFor="tpl" className="text-sm">
                  Crear automáticamente
                </Label>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  <li>Tareas de onboarding inicial</li>
                  <li>Calendario mes 1</li>
                  <li>Pilares de contenido base</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              La auto-creación se activará desde el módulo Tareas (próximamente).
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          )}
          {step < maxStep ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={create.isPending || !step1Valid || !step2Valid}
            >
              {create.isPending ? "Creando..." : "Crear proyecto"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
