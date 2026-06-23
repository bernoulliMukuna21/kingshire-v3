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
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
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
        };
        Update: {
          title?: string;
          description?: string;
          budget?: number;
          categories?: string[];
          service_tags_required?: string[];
          rate_type?: "fixed" | "per_hour" | "per_day";
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
    Functions: Record<string, never>;
  };
};
