import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskPriority, TaskStatus } from "@/hooks/useTasks";

/** A task scheduled into someone's week (table `task_time_blocks`). */
export type TimeBlock = {
  id: string;
  workspace_id: string;
  task_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    project_id: string | null;
  } | null;
};

const BLOCK_SELECT = "*, task:tasks(id, title, status, priority, project_id)";

const key = (workspaceId?: string, userId?: string, from?: string, to?: string) =>
  ["time-blocks", workspaceId, userId, from, to] as const;

/** Blocks of one user that overlap [from, to). */
export function useTimeBlocks(
  workspaceId: string | undefined,
  userId: string | undefined,
  from: Date,
  to: Date,
) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery<TimeBlock[]>({
    queryKey: key(workspaceId, userId, fromIso, toIso),
    enabled: !!workspaceId && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_time_blocks")
        .select(BLOCK_SELECT)
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .lt("starts_at", toIso)
        .gt("ends_at", fromIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimeBlock[];
    },
  });
}

export function useCreateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      task_id: string;
      starts_at: string;
      ends_at: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("task_time_blocks")
        .insert(input)
        .select(BLOCK_SELECT)
        .single();
      if (error) throw error;
      return data as TimeBlock;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["time-blocks"] }),
  });
}

/** Moves or resizes a block, updating every cached week optimistically. */
export function useUpdateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, starts_at, ends_at }: { id: string; starts_at: string; ends_at: string }) => {
      const { error } = await (supabase as any)
        .from("task_time_blocks")
        .update({ starts_at, ends_at, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, starts_at, ends_at }) => {
      await qc.cancelQueries({ queryKey: ["time-blocks"] });
      const snapshot = qc.getQueriesData<TimeBlock[]>({ queryKey: ["time-blocks"] });
      qc.setQueriesData<TimeBlock[]>({ queryKey: ["time-blocks"] }, (old) =>
        old?.map((b) => (b.id === id ? { ...b, starts_at, ends_at } : b)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["time-blocks"] }),
  });
}

export function useDeleteTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("task_time_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["time-blocks"] });
      const snapshot = qc.getQueriesData<TimeBlock[]>({ queryKey: ["time-blocks"] });
      qc.setQueriesData<TimeBlock[]>({ queryKey: ["time-blocks"] }, (old) => old?.filter((b) => b.id !== id));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["time-blocks"] }),
  });
}
