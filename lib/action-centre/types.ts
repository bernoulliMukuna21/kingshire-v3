import type { createClient } from "@/lib/supabase/server";

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ActionCentreRole = "client" | "kinglancer";
export type ActionKind = "action" | "waiting";
export type ActionTone =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "slate"
  | "purple";
export type ActionIcon =
  | "review"
  | "review-work"
  | "applicants"
  | "request"
  | "payment"
  | "placement"
  | "alert";

export type ActionCentreItem = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  /** Canonical destination — surfaces append their own `?from` source. */
  href: string;
  icon: ActionIcon;
  badge: string;
  tone: ActionTone;
  meta?: string;
  /** Organisation name, when the action belongs to a workspace (not personal). */
  context?: string;
};

export type ActionCentre = {
  items: ActionCentreItem[];
  actionCount: number;
  waitingCount: number;
};

export type ActionContext = {
  supabase: ServerClient;
  userId: string;
  role: ActionCentreRole;
};

export type ActionProvider = (
  ctx: ActionContext,
) => Promise<ActionCentreItem[]>;

export type ClientActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  posting_type: string;
  pay_negotiable: boolean | null;
  pay_amount: number | null;
  pay_cadence: string | null;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
  has_funded_transaction?: boolean;
  has_pending_payment?: boolean;
  counter_budget: number | null;
  counter_rate_type: string | null;
  counter_deadline: string | null;
  kinglancer: { full_name: string | null } | null;
  invited_kinglancer: { full_name: string | null } | null;
};

export type KinglancerActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  posting_type: string;
  pay_negotiable: boolean | null;
  pay_amount: number | null;
  pay_cadence: string | null;
  direct_request_status: string | null;
  has_funded_transaction?: boolean;
  client: { full_name: string | null } | null;
};

export type AccountOrganisation = { id: string; name: string };
