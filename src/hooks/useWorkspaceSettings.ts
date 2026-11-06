import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectType } from "@/integrations/supabase/enums";

export type ServicePriceType = "daily" | "weekly" | "monthly" | "annual" | "one_time";

export const SERVICE_PRICE_TYPE_LABEL: Record<ServicePriceType, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
  annual: "Anual",
  one_time: "Una vez",
};

export const SERVICE_PRICE_TYPE_SUFFIX: Record<ServicePriceType, string> = {
  daily: "/día",
  weekly: "/sem",
  monthly: "/mes",
  annual: "/año",
  one_time: "",
};

export type WorkspaceService = {
  id: string;
  category: ProjectType;
  name: string;
  description: string;
  target_audience: string;
  not_included: string;
  expected_result: string;
  price: number | null;
  price_type: ServicePriceType;
};

function normalizeService(raw: any): WorkspaceService {
  const validCategories: ProjectType[] = [
    "web_dev",
    "social_media",
    "paid_ads",
    "graphic_design",
    "branding",
    "audit",
  ];
  const validPriceTypes: ServicePriceType[] = ["daily", "weekly", "monthly", "annual", "one_time"];
  return {
    id: raw?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())),
    category: validCategories.includes(raw?.category) ? raw.category : "social_media",
    name: typeof raw?.name === "string" ? raw.name : "",
    description: typeof raw?.description === "string" ? raw.description : "",
    target_audience: typeof raw?.target_audience === "string" ? raw.target_audience : "",
    not_included: typeof raw?.not_included === "string" ? raw.not_included : "",
    expected_result: typeof raw?.expected_result === "string" ? raw.expected_result : "",
    price: raw?.price === null || raw?.price === undefined || raw?.price === "" ? null : Number(raw.price),
    price_type: validPriceTypes.includes(raw?.price_type) ? raw.price_type : "one_time",
  };
}

export type WorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  website: string | null;
  location: string | null;
  services: WorkspaceService[];
};

export function useWorkspaceDetail(workspaceId: string | undefined) {
  return useQuery<WorkspaceDetail | null>({
    queryKey: ["workspace-detail", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspaces")
        .select("id, name, slug, logo_url, primary_color, secondary_color, website, location, services")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        services: Array.isArray(data.services) ? (data.services as any[]).map(normalizeService) : [],
      } as WorkspaceDetail;
    },
  });
}

export type UpdateWorkspacePatch = {
  name?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  website?: string | null;
  location?: string | null;
  services?: WorkspaceService[];
};

export function useUpdateWorkspace(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UpdateWorkspacePatch) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { error } = await (supabase as any)
        .from("workspaces")
        .update(patch)
        .eq("id", workspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
    },
  });
}

// ============ Default Pillars ============

export type DefaultPillar = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  description: string | null;
  sort_order: number;
};

export function useWorkspaceDefaultPillars(workspaceId: string | undefined) {
  return useQuery<DefaultPillar[]>({
    queryKey: ["workspace-default-pillars", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_default_pillars")
        .select("id, workspace_id, name, color, description, sort_order")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DefaultPillar[];
    },
  });
}

export function useCreateWorkspaceDefaultPillar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; description?: string }) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data: existing } = await (supabase as any)
        .from("workspace_default_pillars")
        .select("sort_order")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const { data, error } = await (supabase as any)
        .from("workspace_default_pillars")
        .insert({
          workspace_id: workspaceId,
          name: input.name.trim(),
          color: input.color,
          description: input.description ?? null,
          sort_order: nextOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-default-pillars", workspaceId] });
    },
  });
}

export function useUpdateWorkspaceDefaultPillar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; description?: string }) => {
      const patch: Record<string, any> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.color !== undefined) patch.color = input.color;
      if (input.description !== undefined) patch.description = input.description;
      const { error } = await (supabase as any)
        .from("workspace_default_pillars")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-default-pillars", workspaceId] });
    },
  });
}

export function useDeleteWorkspaceDefaultPillar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("workspace_default_pillars")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-default-pillars", workspaceId] });
    },
  });
}

export function useReorderWorkspaceDefaultPillars(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          (supabase as any)
            .from("workspace_default_pillars")
            .update({ sort_order: idx })
            .eq("id", id),
        ),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-default-pillars", workspaceId] });
    },
  });
}

// ============ Templates ============

export type TemplateCategory = "contrato" | "propuesta" | "reporte" | "otro";

export type WorkspaceTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  category: TemplateCategory;
  body: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useWorkspaceTemplates(workspaceId: string | undefined) {
  return useQuery<WorkspaceTemplate[]>({
    queryKey: ["workspace-templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_templates")
        .select("id, workspace_id, name, category, body, file_url, created_by, created_at, updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceTemplate[];
    },
  });
}

export type TemplateInput = {
  name: string;
  category: TemplateCategory;
  body?: string | null;
  file_url?: string | null;
};

export function useCreateWorkspaceTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      if (!workspaceId) throw new Error("workspaceId requerido");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("workspace_templates")
        .insert({
          workspace_id: workspaceId,
          name: input.name.trim(),
          category: input.category,
          body: input.body || null,
          file_url: input.file_url || null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-templates", workspaceId] });
    },
  });
}

export function useUpdateWorkspaceTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<TemplateInput> }) => {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.patch.name !== undefined) patch.name = input.patch.name.trim();
      if (input.patch.category !== undefined) patch.category = input.patch.category;
      if (input.patch.body !== undefined) patch.body = input.patch.body || null;
      if (input.patch.file_url !== undefined) patch.file_url = input.patch.file_url || null;
      const { error } = await (supabase as any)
        .from("workspace_templates")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-templates", workspaceId] });
    },
  });
}

export function useDeleteWorkspaceTemplate(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("workspace_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-templates", workspaceId] });
    },
  });
}

// ============ Notification Preferences ============

export type NotificationEventType =
  | "post_approved"
  | "post_rejected"
  | "post_changes_requested"
  | "invite_accepted"
  | "new_lead"
  | "proposal_signed"
  | "contract_signed"
  | "contract_expiring"
  | "task_assigned"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "invoice_payment_failed"
  | "payment_received";

export type NotificationChannel = "in_app" | "email" | "push";

export type NotificationChannelPrefs = Record<NotificationChannel, boolean>;

export const NOTIFICATION_CHANNEL_DEFAULTS: NotificationChannelPrefs = {
  in_app: true,
  email: false,
  push: false,
};

export const NOTIFICATION_EVENT_GROUPS: {
  label: string;
  events: { key: NotificationEventType; label: string }[];
}[] = [
  {
    label: "Contenido",
    events: [
      { key: "post_approved", label: "Cliente aprobó un post" },
      { key: "post_rejected", label: "Cliente rechazó un post" },
      { key: "post_changes_requested", label: "Cliente solicitó cambios" },
    ],
  },
  {
    label: "Clientes y ventas",
    events: [
      { key: "invite_accepted", label: "Invitación al portal aceptada" },
      { key: "new_lead", label: "Nuevo lead" },
      { key: "proposal_signed", label: "Propuesta firmada" },
      { key: "contract_signed", label: "Contrato firmado" },
      { key: "contract_expiring", label: "Contrato por vencer" },
    ],
  },
  {
    label: "Tareas",
    events: [{ key: "task_assigned", label: "Me asignaron una tarea" }],
  },
  {
    label: "Finanzas",
    events: [
      { key: "invoice_sent", label: "Factura enviada" },
      { key: "invoice_paid", label: "Factura pagada" },
      { key: "payment_received", label: "Pago recibido" },
      { key: "invoice_overdue", label: "Factura vencida" },
      { key: "invoice_payment_failed", label: "Pago de factura fallido" },
    ],
  },
];

export const NOTIFICATION_EVENTS = NOTIFICATION_EVENT_GROUPS.flatMap((g) => g.events);

export type NotificationPreferencesMap = Record<NotificationEventType, NotificationChannelPrefs>;

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery<NotificationPreferencesMap>({
    queryKey: ["notification-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_preferences")
        .select("event_type, in_app_enabled, email_enabled, push_enabled")
        .eq("user_id", userId);
      if (error) throw error;
      const map = {} as NotificationPreferencesMap;
      for (const ev of NOTIFICATION_EVENTS) map[ev.key] = { ...NOTIFICATION_CHANNEL_DEFAULTS };
      for (const row of data ?? []) {
        if (!(row.event_type in map)) continue;
        map[row.event_type as NotificationEventType] = {
          in_app: row.in_app_enabled ?? true,
          email: row.email_enabled ?? false,
          push: row.push_enabled ?? false,
        };
      }
      return map;
    },
  });
}

/**
 * Upserts one or more (event, channel prefs) rows. Each row is written with all
 * three channels so a new row never resets the others to their DB defaults.
 */
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      workspaceId: string;
      changes: { eventType: NotificationEventType; prefs: NotificationChannelPrefs }[];
    }) => {
      const now = new Date().toISOString();
      const { error } = await (supabase as any).from("notification_preferences").upsert(
        input.changes.map((c) => ({
          user_id: input.userId,
          workspace_id: input.workspaceId,
          event_type: c.eventType,
          in_app_enabled: c.prefs.in_app,
          email_enabled: c.prefs.email,
          push_enabled: c.prefs.push,
          updated_at: now,
        })),
        { onConflict: "user_id,event_type" },
      );
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const key = ["notification-preferences", vars.userId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<NotificationPreferencesMap>(key);
      if (previous) {
        const next = { ...previous };
        for (const c of vars.changes) next[c.eventType] = c.prefs;
        qc.setQueryData(key, next);
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["notification-preferences", vars.userId], ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["notification-preferences", vars.userId] });
    },
  });
}
