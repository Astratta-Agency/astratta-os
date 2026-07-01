import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddComment, useDeleteComment, useTaskComments } from "@/hooks/useTasks";
import type { WorkspaceMember } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  taskId: string;
  members: WorkspaceMember[];
}

function memberOf(members: WorkspaceMember[], id: string) {
  const m = members.find((x) => x.user_id === id);
  const name = m?.full_name || m?.email || "Usuario";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return { name, initials, avatar: m?.avatar_url };
}

export function TaskComments({ taskId, members }: Props) {
  const { user } = useAuth();
  const { data: comments = [] } = useTaskComments(taskId);
  const add = useAddComment();
  const del = useDeleteComment();
  const [body, setBody] = useState("");

  const submit = async () => {
    if (!body.trim()) return;
    try {
      await add.mutateAsync({ taskId, body: body.trim() });
      setBody("");
    } catch (e: any) {
      toast.error("No se pudo comentar", { description: e?.message });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Comentarios</h3>

      <div className="space-y-3">
        {comments.map((c) => {
          const m = memberOf(members, c.author_id);
          const isMine = user?.id === c.author_id;
          return (
            <div key={c.id} className="group flex gap-2">
              <Avatar className="mt-0.5 h-7 w-7">
                {m.avatar && <AvatarImage src={m.avatar} />}
                <AvatarFallback className="text-[10px]">{m.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{m.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                    </span>
                    {isMine && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => del.mutate({ id: c.id, taskId })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{c.body}</div>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay comentarios.</p>
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribir un comentario…"
          rows={2}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
