export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          name: string;
          organisation_type:
            | "company"
            | "charity"
            | "church"
            | "non_profit"
            | "community_group"
            | "public_body"
            | "other";
          description: string | null;
          country: string;
          location: string | null;
          website: string | null;
          email: string | null;
          phone: string | null;
          registration_number: string | null;
          logo_url: string | null;
          deleted_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          organisation_type:
            | "company"
            | "charity"
            | "church"
            | "non_profit"
            | "community_group"
            | "public_body"
            | "other";
          description?: string | null;
          country?: string;
          location?: string | null;
          website?: string | null;
          email?: string | null;
          phone?: string | null;
          registration_number?: string | null;
          logo_url?: string | null;
          deleted_at?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          organisation_type?:
            | "company"
            | "charity"
            | "church"
            | "non_profit"
            | "community_group"
            | "public_body"
            | "other";
          description?: string | null;
          country?: string;
          location?: string | null;
          website?: string | null;
          email?: string | null;
          phone?: string | null;
          registration_number?: string | null;
          logo_url?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      organisation_members: {
        Row: {
          organisation_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          joined_at: string;
        };
        Insert: {
          organisation_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          joined_at?: string;
        };
        Update: {
          role?: "owner" | "admin" | "member";
        };
        Relationships: [];
      };
      organisation_invitations: {
        Row: {
          id: string;
          organisation_id: string;
          email: string;
          role: "admin" | "member";
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          organisation_id: string;
          email: string;
          role: "admin" | "member";
          token?: string;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          role?: "admin" | "member";
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      organisation_setup_drafts: {
        Row: {
          id: string;
          request_key: string;
          actor_id: string;
          name: string;
          organisation_type:
            | "company"
            | "charity"
            | "church"
            | "non_profit"
            | "community_group"
            | "public_body"
            | "other";
          description: string | null;
          country: string;
          location: string | null;
          website: string | null;
          registration_number: string | null;
          selected_plan: "starter" | "growth" | "scale";
          stripe_price_id: string;
          stripe_checkout_session_id: string | null;
          status:
            | "draft"
            | "checkout_pending"
            | "active"
            | "cancelled"
            | "failed";
          organisation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          request_key: string;
          actor_id: string;
          name: string;
          organisation_type:
            | "company"
            | "charity"
            | "church"
            | "non_profit"
            | "community_group"
            | "public_body"
            | "other";
          description?: string | null;
          country?: string;
          location?: string | null;
          website?: string | null;
          registration_number?: string | null;
          selected_plan: "starter" | "growth" | "scale";
          stripe_price_id: string;
          stripe_checkout_session_id?: string | null;
          status?:
            | "draft"
            | "checkout_pending"
            | "active"
            | "cancelled"
            | "failed";
          organisation_id?: string | null;
        };
        Update: {
          stripe_checkout_session_id?: string | null;
          status?:
            | "draft"
            | "checkout_pending"
            | "active"
            | "cancelled"
            | "failed";
          organisation_id?: string | null;
        };
        Relationships: [];
      };
      organisation_subscriptions: {
        Row: {
          organisation_id: string;
          plan: "starter" | "growth" | "scale";
          status:
            | "incomplete"
            | "incomplete_expired"
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_checkout_session_id: string;
          stripe_price_id: string;
          cancel_at_period_end: boolean;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organisation_id: string;
          plan: "starter" | "growth" | "scale";
          status:
            | "incomplete"
            | "incomplete_expired"
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_checkout_session_id: string;
          stripe_price_id: string;
          cancel_at_period_end?: boolean;
          current_period_end?: string | null;
        };
        Update: {
          plan?: "starter" | "growth" | "scale";
          status?:
            | "incomplete"
            | "incomplete_expired"
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_price_id?: string;
          cancel_at_period_end?: boolean;
          current_period_end?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: "client" | "kinglancer" | "admin" | null;
          bio: string | null;
          phone: string | null;
          service_tags: string[];
          location: string | null;
          hourly_rate: number | null;
          tagline: string | null;
          rate_type: "per_hour" | "per_day" | "per_project";
          services: Array<{ name: string; rate: number; rate_type: string }>;
          rating: number;
          total_reviews: number;
          jobs_completed: number;
          is_verified: boolean;
          portfolio_url: string | null;
          cv_url: string | null;
          stripe_account_id: string | null;
          stripe_onboarding_complete: boolean;
          open_to_placements: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: "client" | "kinglancer" | "admin" | null;
          service_tags: string[];
          avatar_url?: string | null;
          bio?: string | null;
          phone?: string | null;
          location?: string | null;
          hourly_rate?: number | null;
          tagline?: string | null;
          rate_type?: "per_hour" | "per_day" | "per_project";
          services?: Array<{
            name: string;
            rate: number;
            rate_type: string;
          }> | null;
          portfolio_url?: string | null;
          cv_url?: string | null;
          open_to_placements?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: "client" | "kinglancer" | "admin" | null;
          service_tags?: string[];
          avatar_url?: string | null;
          bio?: string | null;
          phone?: string | null;
          location?: string | null;
          hourly_rate?: number | null;
          tagline?: string | null;
          rate_type?: "per_hour" | "per_day" | "per_project";
          services?: Array<{
            name: string;
            rate: number;
            rate_type: string;
          }> | null;
          portfolio_url?: string | null;
          cv_url?: string | null;
          stripe_account_id?: string | null;
          stripe_onboarding_complete?: boolean;
          open_to_placements?: boolean;
        };
        Relationships: [];
      };
      placements: {
        Row: {
          id: string;
          organisation_id: string;
          created_by: string;
          title: string;
          summary: string;
          categories: string[];
          contribution: string;
          reward: string | null;
          location: string | null;
          is_remote: boolean;
          work_mode: "remote" | "hybrid" | "onsite";
          days_on_site: number | null;
          compensation_types: string[];
          compensation_note: string | null;
          compensation_details: Record<string, unknown>;
          weekly_hours: number;
          duration_weeks: number;
          start_date: string | null;
          end_date: string | null;
          status: "draft" | "pending_review" | "open" | "closed" | "cancelled";
          requires_manual_review: boolean;
          payment_mode: "managed" | "direct";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          created_by: string;
          title: string;
          summary: string;
          categories?: string[];
          contribution: string;
          reward?: string | null;
          location?: string | null;
          is_remote?: boolean;
          work_mode?: "remote" | "hybrid" | "onsite";
          days_on_site?: number | null;
          compensation_types?: string[];
          compensation_note?: string | null;
          compensation_details?: Record<string, unknown>;
          weekly_hours?: number;
          duration_weeks?: number;
          start_date?: string | null;
          end_date?: string | null;
          status?: "draft" | "pending_review" | "open" | "closed" | "cancelled";
          requires_manual_review?: boolean;
          payment_mode?: "managed" | "direct";
        };
        Update: {
          title?: string;
          summary?: string;
          categories?: string[];
          contribution?: string;
          reward?: string | null;
          location?: string | null;
          is_remote?: boolean;
          work_mode?: "remote" | "hybrid" | "onsite";
          days_on_site?: number | null;
          compensation_types?: string[];
          compensation_note?: string | null;
          compensation_details?: Record<string, unknown>;
          weekly_hours?: number;
          duration_weeks?: number;
          start_date?: string | null;
          end_date?: string | null;
          status?: "draft" | "pending_review" | "open" | "closed" | "cancelled";
          requires_manual_review?: boolean;
          payment_mode?: "managed" | "direct";
        };
        Relationships: [];
      };
      placement_applications: {
        Row: {
          id: string;
          placement_id: string;
          kinglancer_id: string;
          message: string | null;
          cv_url: string | null;
          status: "pending" | "accepted" | "rejected" | "withdrawn";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          placement_id: string;
          kinglancer_id: string;
          message?: string | null;
          cv_url?: string | null;
          status?: "pending" | "accepted" | "rejected" | "withdrawn";
        };
        Update: {
          message?: string | null;
          cv_url?: string | null;
          status?: "pending" | "accepted" | "rejected" | "withdrawn";
        };
        Relationships: [];
      };
      placement_agreements: {
        Row: {
          id: string;
          placement_id: string;
          organisation_id: string;
          kinglancer_id: string;
          version: number;
          contribution_terms: string;
          reward_terms: string;
          weekly_hours: number;
          duration_weeks: number;
          status: "pending_acceptance" | "active" | "completed" | "cancelled";
          org_signed_by: string | null;
          org_signed_at: string | null;
          kinglancer_signed_at: string | null;
          completed_at: string | null;
          payment_mode: "managed" | "direct";
          monthly_amount: number | null;
          end_requested_by: string | null;
          end_requested_at: string | null;
          end_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          placement_id: string;
          organisation_id: string;
          kinglancer_id: string;
          version?: number;
          contribution_terms: string;
          reward_terms: string;
          weekly_hours: number;
          duration_weeks: number;
          status?: "pending_acceptance" | "active" | "completed" | "cancelled";
          org_signed_by?: string | null;
          org_signed_at?: string | null;
          kinglancer_signed_at?: string | null;
          completed_at?: string | null;
          payment_mode?: "managed" | "direct";
          monthly_amount?: number | null;
          end_requested_by?: string | null;
          end_requested_at?: string | null;
          end_reason?: string | null;
        };
        Update: {
          version?: number;
          contribution_terms?: string;
          reward_terms?: string;
          weekly_hours?: number;
          duration_weeks?: number;
          status?: "pending_acceptance" | "active" | "completed" | "cancelled";
          org_signed_by?: string | null;
          org_signed_at?: string | null;
          kinglancer_signed_at?: string | null;
          completed_at?: string | null;
          payment_mode?: "managed" | "direct";
          monthly_amount?: number | null;
          end_requested_by?: string | null;
          end_requested_at?: string | null;
          end_reason?: string | null;
        };
        Relationships: [];
      };
      placement_payments: {
        Row: {
          id: string;
          agreement_id: string;
          organisation_id: string;
          kinglancer_id: string;
          period_index: number;
          due_date: string | null;
          amount: number;
          platform_fee_client: number;
          platform_fee_kinglancer: number;
          status:
            | "due"
            | "processing"
            | "held"
            | "released"
            | "failed"
            | "cancelled"
            | "disputed"
            | "refunded";
          stripe_payment_intent_id: string | null;
          stripe_transfer_id: string | null;
          paid_at: string | null;
          released_at: string | null;
          notice_sent_at: string | null;
          dispute_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agreement_id: string;
          organisation_id: string;
          kinglancer_id: string;
          period_index: number;
          due_date?: string | null;
          amount: number;
          platform_fee_client?: number;
          platform_fee_kinglancer?: number;
          status?:
            | "due"
            | "processing"
            | "held"
            | "released"
            | "failed"
            | "cancelled"
            | "disputed"
            | "refunded";
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          paid_at?: string | null;
          released_at?: string | null;
          notice_sent_at?: string | null;
          dispute_reason?: string | null;
        };
        Update: {
          period_index?: number;
          due_date?: string | null;
          amount?: number;
          platform_fee_client?: number;
          platform_fee_kinglancer?: number;
          status?:
            | "due"
            | "processing"
            | "held"
            | "released"
            | "failed"
            | "cancelled"
            | "disputed"
            | "refunded";
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          paid_at?: string | null;
          released_at?: string | null;
          notice_sent_at?: string | null;
          dispute_reason?: string | null;
        };
        Relationships: [];
      };
      placement_milestones: {
        Row: {
          id: string;
          agreement_id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          status: "pending" | "confirmed";
          confirmed_by: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agreement_id: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          status?: "pending" | "confirmed";
          confirmed_by?: string | null;
          confirmed_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          due_date?: string | null;
          status?: "pending" | "confirmed";
          confirmed_by?: string | null;
          confirmed_at?: string | null;
        };
        Relationships: [];
      };
      placement_check_ins: {
        Row: {
          id: string;
          agreement_id: string;
          author_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agreement_id: string;
          author_id: string;
          note: string;
        };
        Update: {
          note?: string;
        };
        Relationships: [];
      };
      experience_records: {
        Row: {
          id: string;
          agreement_id: string | null;
          placement_id: string | null;
          organisation_id: string;
          kinglancer_id: string;
          title: string;
          summary: string | null;
          skills: string[];
          outcome: string | null;
          reference_text: string | null;
          is_public: boolean;
          categories: string[];
          verification_status: "pending" | "approved" | "rejected";
          verified_at: string | null;
          verified_by: string | null;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agreement_id?: string | null;
          placement_id?: string | null;
          organisation_id: string;
          kinglancer_id: string;
          title: string;
          summary?: string | null;
          skills?: string[];
          outcome?: string | null;
          reference_text?: string | null;
          is_public?: boolean;
          categories?: string[];
          verification_status?: "pending" | "approved" | "rejected";
          verified_at?: string | null;
          verified_by?: string | null;
          completed_at?: string;
        };
        Update: {
          title?: string;
          summary?: string | null;
          skills?: string[];
          outcome?: string | null;
          reference_text?: string | null;
          is_public?: boolean;
          categories?: string[];
          verification_status?: "pending" | "approved" | "rejected";
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          organisation_id: string | null;
          created_by: string;
          title: string;
          description: string;
          budget: number;
          categories: string[];
          service_tags_required: string[];
          status:
            | "open"
            | "in_progress"
            | "completed"
            | "cancelled"
            | "disputed"
            | "approved";
          deadline: string | null;
          kinglancer_id: string | null;
          invited_kinglancer_id: string | null;
          direct_request_status:
            | "pending"
            | "changes_requested"
            | "accepted_pending_payment"
            | "declined"
            | "cancelled"
            | null;
          direct_request_message: string | null;
          counter_budget: number | null;
          counter_rate_type: "fixed" | "per_hour" | "per_day" | null;
          counter_deadline: string | null;
          rate_type: "fixed" | "per_hour" | "per_day";
          work_mode: "online" | "in_person" | "hybrid";
          location: string | null;
          scheduled_at: string | null;
          ends_at: string | null;
          days_on_site: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          organisation_id?: string | null;
          created_by: string;
          title: string;
          description: string;
          budget: number;
          categories: string[];
          service_tags_required?: string[];
          deadline?: string | null;
          kinglancer_id?: string | null;
          invited_kinglancer_id?: string | null;
          direct_request_status?:
            | "pending"
            | "changes_requested"
            | "accepted_pending_payment"
            | "declined"
            | "cancelled"
            | null;
          direct_request_message?: string | null;
          counter_budget?: number | null;
          counter_rate_type?: "fixed" | "per_hour" | "per_day" | null;
          counter_deadline?: string | null;
          rate_type?: "fixed" | "per_hour" | "per_day";
          work_mode?: "online" | "in_person" | "hybrid";
          location?: string | null;
          scheduled_at?: string | null;
          ends_at?: string | null;
          days_on_site?: number | null;
        };
        Update: {
          organisation_id?: string | null;
          title?: string;
          description?: string;
          budget?: number;
          categories?: string[];
          service_tags_required?: string[];
          rate_type?: "fixed" | "per_hour" | "per_day";
          work_mode?: "online" | "in_person" | "hybrid";
          location?: string | null;
          scheduled_at?: string | null;
          ends_at?: string | null;
          days_on_site?: number | null;
          invited_kinglancer_id?: string | null;
          direct_request_status?:
            | "pending"
            | "changes_requested"
            | "accepted_pending_payment"
            | "declined"
            | "cancelled"
            | null;
          direct_request_message?: string | null;
          counter_budget?: number | null;
          counter_rate_type?: "fixed" | "per_hour" | "per_day" | null;
          counter_deadline?: string | null;
          status?:
            | "open"
            | "in_progress"
            | "completed"
            | "cancelled"
            | "disputed"
            | "approved";
          deadline?: string | null;
          kinglancer_id?: string | null;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          kinglancer_id: string;
          cover_letter: string;
          proposed_rate: number | null;
          status: "pending" | "accepted" | "rejected";
          created_at: string;
        };
        Insert: {
          job_id: string;
          kinglancer_id: string;
          cover_letter: string;
          proposed_rate?: number | null;
        };
        Update: {
          cover_letter?: string;
          status?: "pending" | "accepted" | "rejected";
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          job_id: string;
          application_id: string | null;
          client_id: string;
          kinglancer_id: string;
          amount: number;
          platform_fee_client: number;
          platform_fee_kinglancer: number;
          stripe_payment_intent_id: string | null;
          stripe_transfer_id: string | null;
          status: "pending" | "held" | "released" | "refunded" | "disputed";
          released_at: string | null;
          created_at: string;
        };
        Insert: {
          job_id: string;
          application_id?: string | null;
          client_id: string;
          kinglancer_id: string;
          amount: number;
          platform_fee_client: number;
          platform_fee_kinglancer: number;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          status?: "pending" | "held" | "released" | "refunded" | "disputed";
          released_at?: string | null;
        };
        Update: {
          application_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          status?: "pending" | "held" | "released" | "refunded" | "disputed";
          released_at?: string | null;
        };
        Relationships: [];
      };
      payment_attempts: {
        Row: {
          id: string;
          job_id: string;
          application_id: string | null;
          client_id: string;
          kinglancer_id: string;
          amount: number;
          platform_fee_client: number;
          platform_fee_kinglancer: number;
          stripe_payment_intent_id: string;
          attempt_type: "application" | "direct_request";
          status: "pending" | "succeeded" | "cancelled" | "failed" | "expired";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          job_id: string;
          application_id?: string | null;
          client_id: string;
          kinglancer_id: string;
          amount: number;
          platform_fee_client: number;
          platform_fee_kinglancer: number;
          stripe_payment_intent_id: string;
          attempt_type?: "application" | "direct_request";
          status?: "pending" | "succeeded" | "cancelled" | "failed" | "expired";
        };
        Update: {
          application_id?: string | null;
          status?: "pending" | "succeeded" | "cancelled" | "failed" | "expired";
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          job_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          job_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          is_published?: boolean;
          published_at?: string | null;
        };
        Update: {
          rating?: number;
          comment?: string | null;
          is_published?: boolean;
          published_at?: string | null;
        };
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          job_id: string;
          raised_by: string;
          reason: string;
          status: "open" | "resolved" | "closed";
          resolution: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          job_id: string;
          raised_by: string;
          reason: string;
        };
        Update: {
          status?: "open" | "resolved" | "closed";
          resolution?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type:
            | "new_application"
            | "job_awarded"
            | "work_submitted"
            | "payment_released"
            | "dispute_raised"
            | "new_job"
            | "payout_ready"
            | "direct_request";
          title: string;
          body: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type:
            | "new_application"
            | "job_awarded"
            | "work_submitted"
            | "payment_released"
            | "dispute_raised"
            | "new_job"
            | "payout_ready"
            | "direct_request";
          title: string;
          body: string;
          link?: string | null;
          read?: boolean;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      activate_organisation_setup: {
        Args: {
          p_draft_id: string;
          p_actor_id: string;
          p_stripe_checkout_session_id: string;
          p_stripe_customer_id: string;
          p_stripe_subscription_id: string;
          p_subscription_status: string;
        };
        Returns: string;
      };
      increment_jobs_completed: {
        Args: { user_id: string };
        Returns: void;
      };
      get_client_stats: {
        Args: { p_client_id: string };
        Returns: Array<{
          total_spent: number;
          total_jobs: number;
          open_jobs: number;
          completed_jobs: number;
          total_applicants: number;
        }>;
      };
      get_kinglancer_stats: {
        Args: { p_kinglancer_id: string };
        Returns: Array<{
          total_earned: number;
          total_held: number;
        }>;
      };
    };
  };
};
