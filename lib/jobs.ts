import type { Database } from "@/lib/supabase/types";

/** Derived from the Supabase schema — stays in sync automatically. */
export type JobStatus = Database["public"]["Tables"]["jobs"]["Row"]["status"];

/** Page size used across all job list views (client, kinglancer, admin). */
export const JOBS_PAGE_SIZE = 5;

// Canonical unions for job text columns (DB stores them as CHECK-constrained
// text, generated as `string`), so the narrow types live here.
export type RateType = "fixed" | "per_hour" | "per_day";
export type WorkMode = "online" | "in_person" | "hybrid";
export type DirectRequestStatus =
  | "pending"
  | "changes_requested"
  | "accepted_pending_payment"
  | "declined"
  | "cancelled"
  | null;

export type JobStatusPill = { label: string; className: string; dot: string };

// Single source of truth for job status → user-facing pill (label + colours).
// `completed` = work submitted, awaiting client approval; `approved` = done+paid.
const JOB_STATUS_PILLS: Record<string, JobStatusPill> = {
  open: {
    label: "Open",
    className: "bg-green-50 text-green-700 ring-green-100",
    dot: "bg-green-500",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
    dot: "bg-blue-500",
  },
  completed: {
    label: "Awaiting approval",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    dot: "bg-emerald-500",
  },
  disputed: {
    label: "Disputed",
    className: "bg-red-50 text-red-700 ring-red-100",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
    dot: "bg-slate-400",
  },
};

export function jobStatusPill(status: string): JobStatusPill {
  return JOB_STATUS_PILLS[status] ?? JOB_STATUS_PILLS.open;
}
