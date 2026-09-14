/**
 * Alias con nombre para los enums del esquema `public`.
 *
 * Todos se DERIVAN de `Database["public"]["Enums"]`, no se escriben a mano. Eso
 * significa que `database.types.ts` puede regenerarse cuantas veces haga falta
 * sin romper una sola importación en la aplicación: si un valor cambia en la
 * base de datos, aparece aquí solo, y si un enum desaparece, TypeScript lo
 * señala en este archivo en lugar de en 18 sitios repartidos.
 *
 * Regla: importa los enums desde aquí, nunca desde `database.types.ts`.
 *
 * Para regenerar los tipos base:
 *
 *   npx supabase gen types typescript \
 *     --project-id vdnblnrwkkychxzbixam \
 *     --schema public > src/integrations/supabase/database.types.ts
 */

import type { Database } from "./database.types";

type Enums = Database["public"]["Enums"];

// --- Workspace y membresías ---
export type SubscriptionStatus = Enums["subscription_status"];
export type WorkspaceRole = Enums["workspace_role"];
export type MemberStatus = Enums["member_status"];

// --- Clientes ---
export type ClientStatus = Enums["client_status"];
export type ClientUserRole = Enums["client_user_role"];
export type CredentialCategory = Enums["credential_category"];
export type ClientReportStatus = Enums["client_report_status"];

// --- Proyectos y tareas ---
export type ProjectType = Enums["project_type"];
export type ProjectStatus = Enums["project_status"];
export type TaskStatus = Enums["task_status"];
export type TaskPriority = Enums["task_priority"];
export type TaskType = Enums["task_type"];

// --- Contenido ---
export type PostStatus = Enums["post_status"];
export type PostType = Enums["post_type"];
export type DocumentType = Enums["document_type"];

// --- Ventas y contratos ---
export type LeadStage = Enums["lead_stage"];
export type LeadSource = Enums["lead_source"];
export type ProposalType = Enums["proposal_type"];
export type ProposalStatus = Enums["proposal_status"];
export type ContractStatus = Enums["contract_status"];
