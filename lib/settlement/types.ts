export type Cadence = "weekly" | "monthly";

export type SettlementMode = "managed" | "direct";

export type EngagementStatus =
  | "pending_acceptance"
  | "pending_funding"
  | "active"
  | "ended"
  | "cancelled";

export type EngagementPaymentStatus =
  | "due"
  | "processing"
  | "held"
  | "released"
  | "failed"
  | "cancelled"
  | "disputed"
  | "refunded";

export type EngagementSourceKind = "placement" | "org_role";
