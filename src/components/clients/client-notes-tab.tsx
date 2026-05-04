import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eye, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useClientNotes, useSaveClientNotes } from "@/hooks/useClientDetail";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientNotesTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientNotes(clientId);
  const save = useSaveClientNotes(clientId);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const initialized = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialized.current && data) {
      setBody(data.body_md);
      if (data.updated_at) setSavedAt(new Date(data.updated_at));
      initialized.current = true;
    }
  }, [data]);

  useEffect(() => {
    if (!initialized.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await save.mutateAsync(body);
        setSavedAt(new Date());
      } catch {
        /* toast surfaced elsewhere if needed */
      }
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Solo visible para tu equipo, nunca para el cliente. Soporta markdown.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {save.isPending
              ? "Guardando…"
              : savedAt
                ? `Guardado · hace ${formatDistanceToNow(savedAt, { locale: es })}`
                : "Sin cambios"}
          </span>
          <Button
            size="sm"
            variant={mode === "edit" ? "default" : "outline"}
            onClick={() => setMode("edit")}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            size="sm"
            variant={mode === "preview" ? "default" : "outline"}
            onClick={() => setMode("preview")}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          {mode === "edit" ? (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="# Notas internas&#10;&#10;- Llamada con CEO el 12/05&#10;- Quiere reducir budget Q3"
              className="min-h-[320px] font-mono text-sm"
            />
          ) : (
            <article className="prose prose-sm dark:prose-invert max-w-none min-h-[320px]">
              {body.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Sin notas todavía.</p>
              )}
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
