/**
 * Supabase Database type — placeholder until generated.
 *
 * After applying `docs/migrations/001_astratta_core_schema.sql`, regenerate with:
 *
 *   npx supabase gen types typescript \
 *     --project-id vdnblnrwkkychxzbixam \
 *     --schema public > src/integrations/supabase/database.types.ts
 *
 * The generator will rewrite this file with concrete Row/Insert/Update shapes
 * for every table in the public schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type WorkspaceRole = "owner" | "team_member" | "collaborator";
export type MemberStatus = "active" | "invited" | "suspended";
export type ClientStatus = "prospect" | "active" | "paused" | "churned";
export type ClientUserRole = "client_admin" | "client_viewer";
export type ProjectType =
  | "web_dev"
  | "social_media"
  | "paid_ads"
  | "graphic_design"
  | "branding"
  | "audit";
export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "paused"
  | "delivered"
  | "closed";
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "p0" | "p1" | "p2" | "p3";

export interface Database {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_status: SubscriptionStatus;
      workspace_role: WorkspaceRole;
      member_status: MemberStatus;
      client_status: ClientStatus;
      client_user_role: ClientUserRole;
      project_type: ProjectType;
      project_status: ProjectStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
    };
    CompositeTypes: Record<string, never>;
  };
}
