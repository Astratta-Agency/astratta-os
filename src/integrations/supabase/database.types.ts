export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_content_roles: {
        Row: {
          client_id: string
          created_at: string
          id: string
          member_user_id: string | null
          role_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          member_user_id?: string | null
          role_key: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          member_user_id?: string | null
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_content_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credential_access_log: {
        Row: {
          accessed_at: string
          actor_id: string | null
          credential_id: string
          id: string
          workspace_id: string
        }
        Insert: {
          accessed_at?: string
          actor_id?: string | null
          credential_id: string
          id?: string
          workspace_id: string
        }
        Update: {
          accessed_at?: string
          actor_id?: string | null
          credential_id?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credential_access_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "client_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_access_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credentials: {
        Row: {
          category: Database["public"]["Enums"]["credential_category"]
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          login_url: string | null
          notes: string | null
          updated_at: string
          username: string | null
          vault_secret_id: string
          workspace_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["credential_category"]
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          login_url?: string | null
          notes?: string | null
          updated_at?: string
          username?: string | null
          vault_secret_id: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["credential_category"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          login_url?: string | null
          notes?: string | null
          updated_at?: string
          username?: string | null
          vault_secret_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          category: string
          client_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          public_url: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          public_url: string
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          public_url?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          body_md: string
          client_id: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_md?: string
          client_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_md?: string
          client_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          audience: Json
          client_id: string
          created_at: string
          created_by: string | null
          data_notes: string | null
          executive_summary: string | null
          hero_stats: Json
          highlight: Json | null
          id: string
          kpis: Json
          learnings: string | null
          next_month_plan: string | null
          pdf_public_url: string | null
          pdf_storage_path: string | null
          period_month: number
          period_year: number
          platform_kpis: Json
          published_at: string | null
          recommendations: string | null
          status: Database["public"]["Enums"]["client_report_status"]
          title: string
          top_posts: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience?: Json
          client_id: string
          created_at?: string
          created_by?: string | null
          data_notes?: string | null
          executive_summary?: string | null
          hero_stats?: Json
          highlight?: Json | null
          id?: string
          kpis?: Json
          learnings?: string | null
          next_month_plan?: string | null
          pdf_public_url?: string | null
          pdf_storage_path?: string | null
          period_month: number
          period_year: number
          platform_kpis?: Json
          published_at?: string | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["client_report_status"]
          title: string
          top_posts?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audience?: Json
          client_id?: string
          created_at?: string
          created_by?: string | null
          data_notes?: string | null
          executive_summary?: string | null
          hero_stats?: Json
          highlight?: Json | null
          id?: string
          kpis?: Json
          learnings?: string | null
          next_month_plan?: string | null
          pdf_public_url?: string | null
          pdf_storage_path?: string | null
          period_month?: number
          period_year?: number
          platform_kpis?: Json
          published_at?: string | null
          recommendations?: string | null
          status?: Database["public"]["Enums"]["client_report_status"]
          title?: string
          top_posts?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_timeline_events: {
        Row: {
          actor_id: string | null
          client_id: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          title: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          client_id: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          title: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          client_id?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_timeline_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_timeline_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["client_user_role"]
          status: string
          user_id: string | null
          welcome_message: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["client_user_role"]
          status?: string
          user_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["client_user_role"]
          status?: string
          user_id?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          brand_primary_color: string | null
          brand_secondary_color: string | null
          created_at: string
          health_score: number | null
          id: string
          industry: string | null
          location: string
          logo_url: string | null
          name: string
          notes_internal: string | null
          slug: string
          status: Database["public"]["Enums"]["client_status"]
          stripe_customer_id: string | null
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
          health_score?: number | null
          id?: string
          industry?: string | null
          location?: string
          logo_url?: string | null
          name: string
          notes_internal?: string | null
          slug: string
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          created_at?: string
          health_score?: number | null
          id?: string
          industry?: string | null
          location?: string
          logo_url?: string | null
          name?: string
          notes_internal?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_approval_history: {
        Row: {
          action: string
          actor_user_id: string | null
          client_id: string
          comment: string | null
          created_at: string
          id: string
          metadata: Json | null
          post_id: string
          recipient_emails: string[] | null
          ses_message_ids: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          post_id: string
          recipient_emails?: string[] | null
          ses_message_ids?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          post_id?: string
          recipient_emails?: string[] | null
          ses_message_ids?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_approval_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approval_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          client_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_task_templates: {
        Row: {
          created_at: string
          default_role: string | null
          id: string
          is_active: boolean
          offset_days: number
          post_type: Database["public"]["Enums"]["post_type"] | null
          sort_order: number
          subtask_key: string
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_role?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number
          post_type?: Database["public"]["Enums"]["post_type"] | null
          sort_order?: number
          subtask_key: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_role?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number
          post_type?: Database["public"]["Enums"]["post_type"] | null
          sort_order?: number
          subtask_key?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_task_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_alerts_log: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          threshold_days: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          threshold_days: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          threshold_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_alerts_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          workspace_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          workspace_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_clauses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          contract_id: string
          event_type: string
          id: string
          ip_address: string | null
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          event_type: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          consent_text: string
          contract_id: string
          id: string
          ip_address: string | null
          signature_data_url: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          signer_role: string
          user_agent: string | null
        }
        Insert: {
          consent_text: string
          contract_id: string
          id?: string
          ip_address?: string | null
          signature_data_url: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          signer_role: string
          user_agent?: string | null
        }
        Update: {
          consent_text?: string
          contract_id?: string
          id?: string
          ip_address?: string | null
          signature_data_url?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          signer_role?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          parent_template_id: string | null
          service_type: Database["public"]["Enums"]["proposal_type"]
          version: number
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_template_id?: string | null
          service_type: Database["public"]["Enums"]["proposal_type"]
          version?: number
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_template_id?: string | null
          service_type?: Database["public"]["Enums"]["proposal_type"]
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean
          client_id: string
          client_signed_at: string | null
          content: Json
          countersigned_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          id: string
          parent_contract_id: string | null
          project_id: string | null
          proposal_id: string | null
          public_token: string
          sent_at: string | null
          service_type: Database["public"]["Enums"]["proposal_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          auto_renew?: boolean
          client_id: string
          client_signed_at?: string | null
          content?: Json
          countersigned_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          parent_contract_id?: string | null
          project_id?: string | null
          proposal_id?: string | null
          public_token?: string
          sent_at?: string | null
          service_type: Database["public"]["Enums"]["proposal_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title: string
          total_amount?: number
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          auto_renew?: boolean
          client_id?: string
          client_signed_at?: string | null
          content?: Json
          countersigned_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          parent_contract_id?: string | null
          project_id?: string | null
          proposal_id?: string | null
          public_token?: string
          sent_at?: string | null
          service_type?: Database["public"]["Enums"]["proposal_type"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostics: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_completed: boolean
          lead_id: string
          overall_notes: string | null
          pdf_generated_at: string | null
          sections: Json
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          lead_id: string
          overall_notes?: string | null
          pdf_generated_at?: string | null
          sections?: Json
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string
          overall_notes?: string | null
          pdf_generated_at?: string | null
          sections?: Json
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string | null
          content: Json
          converted_to_post_id: string | null
          created_at: string
          created_by: string | null
          id: string
          period: string | null
          post_id: string | null
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          updated_by: string | null
          visible_in_portal: boolean
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          content?: Json
          converted_to_post_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period?: string | null
          post_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          updated_by?: string | null
          visible_in_portal?: boolean
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          content?: Json
          converted_to_post_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period?: string | null
          post_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          updated_by?: string | null
          visible_in_portal?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_converted_to_post_id_fkey"
            columns: ["converted_to_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expense_date: string
          id: string
          is_billable: boolean
          project_id: string | null
          receipt_url: string | null
          vendor: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          category: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expense_date?: string
          id?: string
          is_billable?: boolean
          project_id?: string | null
          receipt_url?: string | null
          vendor?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          is_billable?: boolean
          project_id?: string | null
          receipt_url?: string | null
          vendor?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          project_id: string | null
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          project_id?: string | null
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          project_id?: string | null
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freelancer_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          google_calendar_id: string | null
          google_email: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_synced_at: string | null
          refresh_token: string
          sync_next_token: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_calendar_id?: string | null
          google_email?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          refresh_token: string
          sync_next_token?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_calendar_id?: string | null
          google_email?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          refresh_token?: string
          sync_next_token?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_sync_map: {
        Row: {
          connection_id: string
          content_hash: string | null
          created_at: string
          entity_id: string
          entity_type: string
          google_event_id: string
          id: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          content_hash?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          google_event_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          content_hash?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          google_event_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_map_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          project_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          project_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          project_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          is_recurring: boolean
          issue_date: string
          notes: string | null
          paid_at: string | null
          project_id: string | null
          recurrence_interval: string | null
          sent_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_hosted_invoice_url: string | null
          stripe_invoice_id: string | null
          stripe_invoice_pdf: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          terms: string | null
          total: number
          updated_at: string
          void_at: string | null
          workspace_id: string
        }
        Insert: {
          amount_paid?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          recurrence_interval?: string | null
          sent_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_hosted_invoice_url?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_pdf?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          void_at?: string | null
          workspace_id: string
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          recurrence_interval?: string | null
          sent_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_hosted_invoice_url?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_pdf?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          updated_at?: string
          void_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          converted_client_id: string | null
          created_at: string
          created_by: string | null
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          notes: string | null
          probability: number
          referral_sources: string[] | null
          service_interest: string | null
          source: Database["public"]["Enums"]["lead_source"]
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          probability?: number
          referral_sources?: string[] | null
          service_interest?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          probability?: number
          referral_sources?: string[] | null
          service_interest?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          before_after_pair_id: string | null
          client_id: string
          consent_form_url: string | null
          consent_required: boolean
          consent_signed: boolean
          created_at: string
          duration_seconds: number | null
          file_name: string
          height: number | null
          id: string
          mime_type: string
          orientation: string | null
          patient_ref: string | null
          public_url: string
          size_bytes: number
          storage_path: string
          tags: string[]
          thumbnail_path: string | null
          thumbnail_url: string | null
          treatment: string | null
          uploaded_by: string | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          before_after_pair_id?: string | null
          client_id: string
          consent_form_url?: string | null
          consent_required?: boolean
          consent_signed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          height?: number | null
          id?: string
          mime_type: string
          orientation?: string | null
          patient_ref?: string | null
          public_url: string
          size_bytes: number
          storage_path: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          treatment?: string | null
          uploaded_by?: string | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          before_after_pair_id?: string | null
          client_id?: string
          consent_form_url?: string | null
          consent_required?: boolean
          consent_signed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          height?: number | null
          id?: string
          mime_type?: string
          orientation?: string | null
          patient_ref?: string | null
          public_url?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          treatment?: string | null
          uploaded_by?: string | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_before_after_pair_id_fkey"
            columns: ["before_after_pair_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_performance_reviews: {
        Row: {
          created_at: string
          id: string
          note: string | null
          period: string
          quality_rating: number
          reviewed_by: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          period: string
          quality_rating: number
          reviewed_by?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          period?: string
          quality_rating?: number
          reviewed_by?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_performance_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          event_type: string
          id: string
          in_app_enabled: boolean
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read: boolean
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          invoice_id: string | null
          method: string
          notes: string | null
          paid_at: string
          receipt_url: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_variants: {
        Row: {
          caption: string
          channel: string
          first_comment: string | null
          hashtags: string | null
          id: string
          is_enabled: boolean
          location: string | null
          mentions: string[]
          post_id: string
          updated_at: string
          updated_by: string | null
          utm_url: string | null
        }
        Insert: {
          caption?: string
          channel: string
          first_comment?: string | null
          hashtags?: string | null
          id?: string
          is_enabled?: boolean
          location?: string | null
          mentions?: string[]
          post_id: string
          updated_at?: string
          updated_by?: string | null
          utm_url?: string | null
        }
        Update: {
          caption?: string
          channel?: string
          first_comment?: string | null
          hashtags?: string | null
          id?: string
          is_enabled?: boolean
          location?: string | null
          mentions?: string[]
          post_id?: string
          updated_at?: string
          updated_by?: string | null
          utm_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_template_tasks: {
        Row: {
          checklist_items: string[]
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          offset_days: number
          parent_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          template_id: string
          title: string
          type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          checklist_items?: string[]
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          offset_days?: number
          parent_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          template_id: string
          title: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          checklist_items?: string[]
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          offset_days?: number
          parent_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          template_id?: string
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_template_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_template_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_team_ids: Json
          budget_amount: number | null
          client_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number | null
          retainer_monthly: boolean
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_team_ids?: Json
          budget_amount?: number | null
          client_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number | null
          retainer_monthly?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_team_ids?: Json
          budget_amount?: number | null
          client_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number | null
          retainer_monthly?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          event_type: string
          id: string
          ip_address: string | null
          occurred_at: string
          proposal_id: string
          user_agent: string | null
        }
        Insert: {
          event_type: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          proposal_id: string
          user_agent?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          proposal_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_signatures: {
        Row: {
          consent_text: string
          id: string
          ip_address: string | null
          proposal_id: string
          signature_data_url: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          consent_text: string
          id?: string
          ip_address?: string | null
          proposal_id: string
          signature_data_url: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          consent_text?: string
          id?: string
          ip_address?: string | null
          proposal_id?: string
          signature_data_url?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["proposal_type"]
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["proposal_type"]
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["proposal_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          currency: string
          first_viewed_at: string | null
          id: string
          lead_id: string
          parent_proposal_id: string | null
          public_token: string
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          total_amount: number
          type: Database["public"]["Enums"]["proposal_type"]
          updated_at: string
          valid_until: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          first_viewed_at?: string | null
          id?: string
          lead_id: string
          parent_proposal_id?: string | null
          public_token?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          total_amount?: number
          type: Database["public"]["Enums"]["proposal_type"]
          updated_at?: string
          valid_until?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          first_viewed_at?: string | null
          id?: string
          lead_id?: string
          parent_proposal_id?: string | null
          public_token?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          total_amount?: number
          type?: Database["public"]["Enums"]["proposal_type"]
          updated_at?: string
          valid_until?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token_secret_id: string | null
          avatar_url: string | null
          client_id: string
          connected_by: string | null
          created_at: string
          display_name: string | null
          external_account_id: string
          followers_count: number | null
          granted_scopes: string[]
          id: string
          last_error: string | null
          last_synced_at: string | null
          platform: string
          refresh_token_secret_id: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          username: string | null
          workspace_id: string
        }
        Insert: {
          access_token_secret_id?: string | null
          avatar_url?: string | null
          client_id: string
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id: string
          followers_count?: number | null
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          platform: string
          refresh_token_secret_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
          workspace_id: string
        }
        Update: {
          access_token_secret_id?: string | null
          avatar_url?: string | null
          client_id?: string
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string
          followers_count?: number | null
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          platform?: string
          refresh_token_secret_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          username?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          caption: string | null
          channels: string[]
          client_id: string
          content_pillar: string | null
          created_at: string
          created_by: string | null
          format_meta: Json
          hashtags: string | null
          id: string
          last_approval_sent_at: string | null
          media_urls: string[]
          preview_url: string | null
          project_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          caption?: string | null
          channels?: string[]
          client_id: string
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          format_meta?: Json
          hashtags?: string | null
          id?: string
          last_approval_sent_at?: string | null
          media_urls?: string[]
          preview_url?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          caption?: string | null
          channels?: string[]
          client_id?: string
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          format_meta?: Json
          hashtags?: string | null
          id?: string
          last_approval_sent_at?: string | null
          media_urls?: string[]
          preview_url?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          interest_tag: string | null
          source_page: string | null
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          interest_tag?: string | null
          source_page?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          interest_tag?: string | null
          source_page?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_recurrence_rules: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          estimated_hours: number | null
          frequency: string
          id: string
          is_active: boolean
          next_run_date: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          estimated_hours?: number | null
          frequency: string
          id?: string
          is_active?: boolean
          next_run_date: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          tags?: string[]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          estimated_hours?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_run_date?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_recurrence_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrence_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrence_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          content_subtask_key: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          lead_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          related_post_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          timer_started_at: string | null
          timer_started_by: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          content_subtask_key?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          lead_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          related_post_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          timer_started_at?: string | null
          timer_started_by?: string | null
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          content_subtask_key?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          lead_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          related_post_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          timer_started_at?: string | null
          timer_started_by?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          client_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          hours: number
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          billable?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          hours: number
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          billable?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          hours?: number
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_default_pillars: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_default_pillars_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["member_status"]
          title: string | null
          user_id: string
          weekly_capacity_hours: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["member_status"]
          title?: string | null
          user_id: string
          weekly_capacity_hours?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["member_status"]
          title?: string | null
          user_id?: string
          weekly_capacity_hours?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_templates: {
        Row: {
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string | null
          default_payment_terms_days: number
          default_tax_rate: number
          id: string
          invoice_notes_default: string | null
          location: string
          logo_url: string | null
          name: string
          onboarded_at: string | null
          primary_color: string
          secondary_color: string
          services: Json
          slug: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          default_payment_terms_days?: number
          default_tax_rate?: number
          id?: string
          invoice_notes_default?: string | null
          location?: string
          logo_url?: string | null
          name: string
          onboarded_at?: string | null
          primary_color?: string
          secondary_color?: string
          services?: Json
          slug: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          default_payment_terms_days?: number
          default_tax_rate?: number
          id?: string
          invoice_notes_default?: string | null
          location?: string
          logo_url?: string | null
          name?: string
          onboarded_at?: string | null
          primary_color?: string
          secondary_color?: string
          services?: Json
          slug?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_workspace: { Args: { _workspace_id: string }; Returns: boolean }
      client_in_member_workspace: {
        Args: { _client_id: string }
        Returns: boolean
      }
      countersign_contract: {
        Args: {
          p_contract_id: string
          p_signature_data_url: string
          p_signer_name: string
        }
        Returns: {
          auto_renew: boolean
          client_id: string
          client_signed_at: string | null
          content: Json
          countersigned_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          id: string
          parent_contract_id: string | null
          project_id: string | null
          proposal_id: string | null
          public_token: string
          sent_at: string | null
          service_type: Database["public"]["Enums"]["proposal_type"]
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          title: string
          total_amount: number
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_client_credential: {
        Args: {
          _category: Database["public"]["Enums"]["credential_category"]
          _client_id: string
          _label: string
          _login_url?: string
          _notes?: string
          _secret: string
          _username?: string
        }
        Returns: string
      }
      create_workspace: {
        Args: { _name: string; _slug?: string }
        Returns: {
          billing_email: string | null
          created_at: string
          created_by: string | null
          default_payment_terms_days: number
          default_tax_rate: number
          id: string
          invoice_notes_default: string | null
          location: string
          logo_url: string | null
          name: string
          onboarded_at: string | null
          primary_color: string
          secondary_color: string
          services: Json
          slug: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_invoice_number: {
        Args: { _workspace_id: string }
        Returns: string
      }
      generate_recurring_tasks: { Args: never; Returns: undefined }
      generate_slug: { Args: { _input: string }; Returns: string }
      get_my_google_calendar_status: {
        Args: { p_workspace_id: string }
        Returns: {
          connected: boolean
          google_email: string
          is_active: boolean
          last_error: string
          last_synced_at: string
        }[]
      }
      get_workspace_public_identity: {
        Args: { p_slug: string }
        Returns: {
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
        }[]
      }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["workspace_role"]
          _workspace_id: string
        }
        Returns: boolean
      }
      invoice_can_write: { Args: { _invoice_id: string }; Returns: boolean }
      invoice_in_member_workspace: {
        Args: { _invoice_id: string }
        Returns: boolean
      }
      is_client_admin: { Args: { _client_id: string }; Returns: boolean }
      is_client_user: { Args: { _client_id: string }; Returns: boolean }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      is_workspace_owner: { Args: { _workspace_id: string }; Returns: boolean }
      mark_overdue_invoices: { Args: never; Returns: undefined }
      notify_workspace_members: {
        Args: {
          p_body: string
          p_event_type: string
          p_link?: string
          p_metadata?: Json
          p_title: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      process_contract_lifecycle: { Args: never; Returns: undefined }
      profile_visible_to_client_user: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      profile_visible_to_workspace_member: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      reveal_client_credential: {
        Args: { _credential_id: string }
        Returns: string
      }
      shares_workspace_with: { Args: { _other_user: string }; Returns: boolean }
      stop_task_timer: {
        Args: { p_note?: string; p_task_id: string }
        Returns: {
          billable: boolean
          client_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          hours: number
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_client_credential_secret: {
        Args: { _credential_id: string; _secret: string }
        Returns: undefined
      }
      update_member_full_name: {
        Args: { _full_name: string; _user_id: string; _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      client_report_status: "draft" | "published"
      client_status: "prospect" | "active" | "paused" | "churned"
      client_user_role: "client_admin" | "client_viewer"
      contract_status:
        | "draft"
        | "sent"
        | "signed_by_client"
        | "countersigned"
        | "active"
        | "expired"
        | "renewed"
        | "cancelled"
      credential_category:
        | "social_media"
        | "analytics"
        | "hosting_domain_cms"
        | "tool_other"
      document_type: "idea" | "script" | "kpi_plan" | "nota" | "otro"
      lead_source:
        | "organic"
        | "referral"
        | "meta_ads"
        | "google_ads"
        | "other"
        | "website"
      lead_stage:
        | "lead"
        | "diagnostico"
        | "propuesta_enviada"
        | "negociacion"
        | "ganado"
        | "perdido"
      member_status: "active" | "invited" | "suspended"
      post_status:
        | "idea"
        | "draft"
        | "pending_internal_review"
        | "pending_approval"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "scheduled"
        | "published"
        | "archived"
      post_type: "feed_post" | "carousel" | "reel" | "story" | "video" | "other"
      project_status:
        | "planning"
        | "in_progress"
        | "paused"
        | "delivered"
        | "closed"
      project_type:
        | "web_dev"
        | "social_media"
        | "paid_ads"
        | "graphic_design"
        | "branding"
        | "audit"
      proposal_status:
        | "draft"
        | "sent"
        | "viewed"
        | "negotiation"
        | "signed"
        | "rejected"
        | "expired"
      proposal_type: "web" | "social" | "ads" | "branding" | "bundle"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      task_priority: "p0" | "p1" | "p2" | "p3"
      task_status: "todo" | "doing" | "review" | "done"
      task_type: "produccion" | "revision" | "aprobacion" | "reunion" | "admin"
      workspace_role: "owner" | "team_member" | "collaborator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_report_status: ["draft", "published"],
      client_status: ["prospect", "active", "paused", "churned"],
      client_user_role: ["client_admin", "client_viewer"],
      contract_status: [
        "draft",
        "sent",
        "signed_by_client",
        "countersigned",
        "active",
        "expired",
        "renewed",
        "cancelled",
      ],
      credential_category: [
        "social_media",
        "analytics",
        "hosting_domain_cms",
        "tool_other",
      ],
      document_type: ["idea", "script", "kpi_plan", "nota", "otro"],
      lead_source: [
        "organic",
        "referral",
        "meta_ads",
        "google_ads",
        "other",
        "website",
      ],
      lead_stage: [
        "lead",
        "diagnostico",
        "propuesta_enviada",
        "negociacion",
        "ganado",
        "perdido",
      ],
      member_status: ["active", "invited", "suspended"],
      post_status: [
        "idea",
        "draft",
        "pending_internal_review",
        "pending_approval",
        "changes_requested",
        "approved",
        "rejected",
        "scheduled",
        "published",
        "archived",
      ],
      post_type: ["feed_post", "carousel", "reel", "story", "video", "other"],
      project_status: [
        "planning",
        "in_progress",
        "paused",
        "delivered",
        "closed",
      ],
      project_type: [
        "web_dev",
        "social_media",
        "paid_ads",
        "graphic_design",
        "branding",
        "audit",
      ],
      proposal_status: [
        "draft",
        "sent",
        "viewed",
        "negotiation",
        "signed",
        "rejected",
        "expired",
      ],
      proposal_type: ["web", "social", "ads", "branding", "bundle"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      task_priority: ["p0", "p1", "p2", "p3"],
      task_status: ["todo", "doing", "review", "done"],
      task_type: ["produccion", "revision", "aprobacion", "reunion", "admin"],
      workspace_role: ["owner", "team_member", "collaborator"],
    },
  },
} as const
