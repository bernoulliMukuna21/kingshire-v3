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
      applications: {
        Row: {
          cover_letter: string
          created_at: string
          id: string
          job_id: string
          kinglancer_id: string
          proposed_rate: number | null
          status: string
        }
        Insert: {
          cover_letter: string
          created_at?: string
          id?: string
          job_id: string
          kinglancer_id: string
          proposed_rate?: number | null
          status?: string
        }
        Update: {
          cover_letter?: string
          created_at?: string
          id?: string
          job_id?: string
          kinglancer_id?: string
          proposed_rate?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          job_id: string
          raised_by: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          raised_by: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          raised_by?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_records: {
        Row: {
          agreement_id: string | null
          categories: string[]
          completed_at: string
          created_at: string
          id: string
          is_public: boolean
          kinglancer_id: string
          organisation_id: string
          outcome: string | null
          placement_id: string | null
          reference_text: string | null
          skills: string[]
          summary: string | null
          title: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          agreement_id?: string | null
          categories?: string[]
          completed_at?: string
          created_at?: string
          id?: string
          is_public?: boolean
          kinglancer_id: string
          organisation_id: string
          outcome?: string | null
          placement_id?: string | null
          reference_text?: string | null
          skills?: string[]
          summary?: string | null
          title: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          agreement_id?: string | null
          categories?: string[]
          completed_at?: string
          created_at?: string
          id?: string
          is_public?: boolean
          kinglancer_id?: string
          organisation_id?: string
          outcome?: string | null
          placement_id?: string | null
          reference_text?: string | null
          skills?: string[]
          summary?: string | null
          title?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_records_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "placement_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_records_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_records_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          budget: number
          categories: string[]
          client_id: string
          counter_budget: number | null
          counter_deadline: string | null
          counter_rate_type: string | null
          created_at: string
          created_by: string
          days_on_site: number | null
          deadline: string | null
          description: string
          direct_request_message: string | null
          direct_request_status: string | null
          ends_at: string | null
          id: string
          invited_kinglancer_id: string | null
          kinglancer_id: string | null
          location: string | null
          organisation_id: string | null
          rate_type: string
          scheduled_at: string | null
          service_tags_required: string[]
          status: string
          title: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          budget: number
          categories?: string[]
          client_id: string
          counter_budget?: number | null
          counter_deadline?: string | null
          counter_rate_type?: string | null
          created_at?: string
          created_by: string
          days_on_site?: number | null
          deadline?: string | null
          description: string
          direct_request_message?: string | null
          direct_request_status?: string | null
          ends_at?: string | null
          id?: string
          invited_kinglancer_id?: string | null
          kinglancer_id?: string | null
          location?: string | null
          organisation_id?: string | null
          rate_type?: string
          scheduled_at?: string | null
          service_tags_required?: string[]
          status?: string
          title: string
          updated_at?: string
          work_mode?: string
        }
        Update: {
          budget?: number
          categories?: string[]
          client_id?: string
          counter_budget?: number | null
          counter_deadline?: string | null
          counter_rate_type?: string | null
          created_at?: string
          created_by?: string
          days_on_site?: number | null
          deadline?: string | null
          description?: string
          direct_request_message?: string | null
          direct_request_status?: string | null
          ends_at?: string | null
          id?: string
          invited_kinglancer_id?: string | null
          kinglancer_id?: string | null
          location?: string | null
          organisation_id?: string | null
          rate_type?: string
          scheduled_at?: string | null
          service_tags_required?: string[]
          status?: string
          title?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_invited_kinglancer_id_fkey"
            columns: ["invited_kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organisation_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organisation_id: string
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organisation_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          joined_at: string
          organisation_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          organisation_id: string
          role: string
          user_id: string
        }
        Update: {
          joined_at?: string
          organisation_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_setup_drafts: {
        Row: {
          actor_id: string
          country: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          organisation_id: string | null
          organisation_type: string
          registration_number: string | null
          request_key: string
          selected_plan: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_price_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          actor_id: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          organisation_id?: string | null
          organisation_type: string
          registration_number?: string | null
          request_key: string
          selected_plan: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          actor_id?: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          organisation_id?: string | null
          organisation_type?: string
          registration_number?: string | null
          request_key?: string
          selected_plan?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_setup_drafts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_setup_drafts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          organisation_id: string
          plan: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          organisation_id: string
          plan: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          organisation_id?: string
          plan?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_subscriptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          country: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          email: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          organisation_type: string
          phone: string | null
          registration_number: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          organisation_type?: string
          phone?: string | null
          registration_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          organisation_type?: string
          phone?: string | null
          registration_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          application_id: string | null
          attempt_type: string
          client_id: string
          client_marked_paid_at: string | null
          created_at: string
          id: string
          job_id: string
          kinglancer_id: string
          method: string
          platform_fee_client: number
          platform_fee_kinglancer: number
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          attempt_type?: string
          client_id: string
          client_marked_paid_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          kinglancer_id: string
          method?: string
          platform_fee_client: number
          platform_fee_kinglancer: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          attempt_type?: string
          client_id?: string
          client_marked_paid_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          kinglancer_id?: string
          method?: string
          platform_fee_client?: number
          platform_fee_kinglancer?: number
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          created_at: string
          payout_link: string
          payout_provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          payout_link: string
          payout_provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          payout_link?: string
          payout_provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_agreements: {
        Row: {
          completed_at: string | null
          contribution_terms: string
          created_at: string
          duration_weeks: number
          end_reason: string | null
          end_requested_at: string | null
          end_requested_by: string | null
          id: string
          kinglancer_archived_at: string | null
          kinglancer_id: string
          kinglancer_signed_at: string | null
          monthly_amount: number | null
          org_signed_at: string | null
          org_signed_by: string | null
          organisation_id: string
          payment_mode: string
          placement_id: string
          reward_terms: string
          status: string
          updated_at: string
          version: number
          weekly_hours: number
        }
        Insert: {
          completed_at?: string | null
          contribution_terms: string
          created_at?: string
          duration_weeks: number
          end_reason?: string | null
          end_requested_at?: string | null
          end_requested_by?: string | null
          id?: string
          kinglancer_archived_at?: string | null
          kinglancer_id: string
          kinglancer_signed_at?: string | null
          monthly_amount?: number | null
          org_signed_at?: string | null
          org_signed_by?: string | null
          organisation_id: string
          payment_mode?: string
          placement_id: string
          reward_terms: string
          status?: string
          updated_at?: string
          version?: number
          weekly_hours: number
        }
        Update: {
          completed_at?: string | null
          contribution_terms?: string
          created_at?: string
          duration_weeks?: number
          end_reason?: string | null
          end_requested_at?: string | null
          end_requested_by?: string | null
          id?: string
          kinglancer_archived_at?: string | null
          kinglancer_id?: string
          kinglancer_signed_at?: string | null
          monthly_amount?: number | null
          org_signed_at?: string | null
          org_signed_by?: string | null
          organisation_id?: string
          payment_mode?: string
          placement_id?: string
          reward_terms?: string
          status?: string
          updated_at?: string
          version?: number
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "placement_agreements_end_requested_by_fkey"
            columns: ["end_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_agreements_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_agreements_org_signed_by_fkey"
            columns: ["org_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_agreements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_agreements_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_applications: {
        Row: {
          created_at: string
          cv_url: string | null
          id: string
          kinglancer_id: string
          message: string | null
          placement_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cv_url?: string | null
          id?: string
          kinglancer_id: string
          message?: string | null
          placement_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cv_url?: string | null
          id?: string
          kinglancer_id?: string
          message?: string | null
          placement_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_applications_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_applications_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_check_ins: {
        Row: {
          agreement_id: string
          author_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          agreement_id: string
          author_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          agreement_id?: string
          author_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_check_ins_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "placement_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_check_ins_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_milestones: {
        Row: {
          agreement_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: string
          title: string
        }
        Insert: {
          agreement_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
        }
        Update: {
          agreement_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_milestones_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "placement_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_milestones_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_payments: {
        Row: {
          agreement_id: string
          amount: number
          created_at: string
          dispute_reason: string | null
          due_date: string | null
          id: string
          kinglancer_id: string
          notice_sent_at: string | null
          organisation_id: string
          paid_at: string | null
          period_index: number
          platform_fee_client: number
          platform_fee_kinglancer: number
          released_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          agreement_id: string
          amount: number
          created_at?: string
          dispute_reason?: string | null
          due_date?: string | null
          id?: string
          kinglancer_id: string
          notice_sent_at?: string | null
          organisation_id: string
          paid_at?: string | null
          period_index: number
          platform_fee_client?: number
          platform_fee_kinglancer?: number
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          amount?: number
          created_at?: string
          dispute_reason?: string | null
          due_date?: string | null
          id?: string
          kinglancer_id?: string
          notice_sent_at?: string | null
          organisation_id?: string
          paid_at?: string | null
          period_index?: number
          platform_fee_client?: number
          platform_fee_kinglancer?: number
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "placement_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_payments_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_payments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          archived_at: string | null
          categories: string[]
          compensation_details: Json
          compensation_note: string | null
          compensation_types: string[]
          contribution: string
          created_at: string
          created_by: string
          days_on_site: number | null
          duration_weeks: number
          end_date: string | null
          id: string
          is_remote: boolean
          location: string | null
          organisation_id: string
          payment_mode: string
          requires_manual_review: boolean
          reward: string | null
          start_date: string | null
          status: string
          summary: string
          title: string
          updated_at: string
          weekly_hours: number
          work_mode: string
        }
        Insert: {
          archived_at?: string | null
          categories?: string[]
          compensation_details?: Json
          compensation_note?: string | null
          compensation_types?: string[]
          contribution: string
          created_at?: string
          created_by: string
          days_on_site?: number | null
          duration_weeks?: number
          end_date?: string | null
          id?: string
          is_remote?: boolean
          location?: string | null
          organisation_id: string
          payment_mode?: string
          requires_manual_review?: boolean
          reward?: string | null
          start_date?: string | null
          status?: string
          summary: string
          title: string
          updated_at?: string
          weekly_hours?: number
          work_mode?: string
        }
        Update: {
          archived_at?: string | null
          categories?: string[]
          compensation_details?: Json
          compensation_note?: string | null
          compensation_types?: string[]
          contribution?: string
          created_at?: string
          created_by?: string
          days_on_site?: number | null
          duration_weeks?: number
          end_date?: string | null
          id?: string
          is_remote?: boolean
          location?: string | null
          organisation_id?: string
          payment_mode?: string
          requires_manual_review?: boolean
          reward?: string | null
          start_date?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          weekly_hours?: number
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          cv_url: string | null
          email: string
          full_name: string
          hourly_rate: number | null
          id: string
          is_verified: boolean
          jobs_completed: number
          location: string | null
          open_to_placements: boolean
          phone: string | null
          portfolio_url: string | null
          rate_type: string
          rating: number
          role: string | null
          service_tags: string[]
          services: Json
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          tagline: string | null
          terms_accepted_at: string | null
          terms_accepted_version: number
          total_reviews: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          cv_url?: string | null
          email: string
          full_name: string
          hourly_rate?: number | null
          id: string
          is_verified?: boolean
          jobs_completed?: number
          location?: string | null
          open_to_placements?: boolean
          phone?: string | null
          portfolio_url?: string | null
          rate_type?: string
          rating?: number
          role?: string | null
          service_tags?: string[]
          services?: Json
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tagline?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: number
          total_reviews?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string
          full_name?: string
          hourly_rate?: number | null
          id?: string
          is_verified?: boolean
          jobs_completed?: number
          location?: string | null
          open_to_placements?: boolean
          phone?: string | null
          portfolio_url?: string | null
          rate_type?: string
          rating?: number
          role?: string | null
          service_tags?: string[]
          services?: Json
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          tagline?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: number
          total_reviews?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_published: boolean
          job_id: string
          published_at: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          job_id: string
          published_at?: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          job_id?: string
          published_at?: string | null
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          application_id: string | null
          client_id: string
          confirmed_by: string | null
          created_at: string
          id: string
          job_id: string
          kinglancer_id: string
          manual_payout_reference: string | null
          payment_method: string
          payout_method: string | null
          platform_fee_client: number
          platform_fee_kinglancer: number
          released_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          client_id: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          job_id: string
          kinglancer_id: string
          manual_payout_reference?: string | null
          payment_method?: string
          payout_method?: string | null
          platform_fee_client: number
          platform_fee_kinglancer: number
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          client_id?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          job_id?: string
          kinglancer_id?: string
          manual_payout_reference?: string | null
          payment_method?: string
          payout_method?: string | null
          platform_fee_client?: number
          platform_fee_kinglancer?: number
          released_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_kinglancer_id_fkey"
            columns: ["kinglancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          plan: string
          role: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan: string
          role: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan?: string
          role?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organisation_invitation: {
        Args: { p_actor_email: string; p_actor_id: string; p_token: string }
        Returns: string
      }
      activate_organisation_setup: {
        Args: {
          p_actor_id: string
          p_draft_id: string
          p_stripe_checkout_session_id: string
          p_stripe_customer_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
        }
        Returns: string
      }
      create_organisation_with_owner: {
        Args: {
          p_actor_id: string
          p_country: string
          p_description: string
          p_email: string
          p_location: string
          p_name: string
          p_organisation_type: string
          p_registration_number: string
          p_website: string
        }
        Returns: string
      }
      delete_organisation_if_allowed: {
        Args: { p_actor_id: string; p_organisation_id: string }
        Returns: undefined
      }
      finalize_manual_payment: { Args: { p_attempt_id: string }; Returns: Json }
      get_client_stats: {
        Args: { p_client_id: string }
        Returns: {
          completed_jobs: number
          open_jobs: number
          total_applicants: number
          total_jobs: number
          total_spent: number
        }[]
      }
      get_kinglancer_stats: {
        Args: { p_kinglancer_id: string }
        Returns: {
          total_earned: number
          total_held: number
        }[]
      }
      get_organisation_stats: {
        Args: { p_organisation_id: string }
        Returns: {
          job_count: number
          member_count: number
          released_spend: number
        }[]
      }
      increment_jobs_completed: {
        Args: { user_id: string }
        Returns: undefined
      }
      recompute_profile_rating: { Args: { target: string }; Returns: undefined }
      reveal_expired_reviews: {
        Args: never
        Returns: {
          job_id: string
          review_id: string
          reviewee_id: string
        }[]
      }
      transfer_organisation_ownership: {
        Args: {
          p_current_owner_id: string
          p_new_owner_id: string
          p_organisation_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
