import { useRef } from "react";
import { Download, File, FileImage, FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getAttachmentSignedUrl,
  useDeleteAttachment,
  useTaskAttachments,
  useUploadAttachment,
  type TaskAttachment,
} from "@/hooks/useTasks";

function humanSize(bytes: number | null) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function IconFor({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/")) return <FileImage className="h-4 w-4" />;
  if (mime?.includes("pdf") || mime?.includes("text")) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

interface Props {
  taskId: string;
  workspaceId: string;
}

export function TaskAttachments({ taskId, workspaceId }: Props) {
  const { data: items = [] } = useTaskAttachments(taskId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ taskId, workspaceId, file });
      } catch (e: any) {
        toast.error(`Falló ${file.name}`, { description: e?.message });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = async (a: TaskAttachment) => {
    try {
      const url = await getAttachmentSignedUrl(a.file_url);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("No se pudo descargar", { description: e?.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Adjuntos</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          {upload.isPending ? "Subiendo…" : "Subir"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="space-y-1.5">
        {items.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-2 rounded-md border px-2 py-1.5"
          >
            <IconFor mime={a.mime_type} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm">{a.file_name}</div>
              {a.file_size && (
                <div className="text-[10px] text-muted-foreground">{humanSize(a.file_size)}</div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(a)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => del.mutate({ id: a.id, path: a.file_url, taskId })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay archivos adjuntos.</p>
        )}
      </div>
    </div>
  );
}
