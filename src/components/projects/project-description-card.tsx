import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateProjectDescription } from "@/hooks/useProjectDetail";
import { toast } from "@/hooks/use-toast";

interface Props {
  projectId: string;
  description: string | null;
}

export function ProjectDescriptionCard({ projectId, description }: Props) {
  const [value, setValue] = useState(description ?? "");
  const save = useUpdateProjectDescription(projectId);

  useEffect(() => {
    setValue(description ?? "");
  }, [description, projectId]);

  const dirty = (description ?? "") !== value;

  const onSave = async () => {
    try {
      await save.mutateAsync(value.trim());
      toast({ title: "Descripción guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Descripción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Agrega una descripción del proyecto..."
          className="resize-none"
        />
        {dirty && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setValue(description ?? "")}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
