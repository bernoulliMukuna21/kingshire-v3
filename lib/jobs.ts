import type { Database } from "@/lib/supabase/types";

/** Derived from the Supabase schema — stays in sync automatically. */
export type JobStatus = Database["public"]["Tables"]["jobs"]["Row"]["status"];

/** Page size used across all job list views (client, kinglancer, admin). */
export const JOBS_PAGE_SIZE = 5;

// Canonical unions for job text columns (DB stores them as CHECK-constrained
// text, generated as `string`), so the narrow types live here.
export type RateType = "fixed" | "per_hour" | "per_day";
export type WorkMode = "online" | "in_person" | "hybrid";
export type ScheduleType = "shift" | "window";
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

/** "30 min" / "1 hour" / "1.5 hours" / "8 hours". */
export function formatEstimatedMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  const rounded = Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

// Durations offered when a client sets a "complete anytime" window (minutes).
// Labels are derived from formatEstimatedMinutes so the wording lives in one place.
export const ESTIMATE_MINUTE_OPTIONS = [
  30, 60, 90, 120, 180, 240, 360, 480,
] as const;

// The narrow set of fields the JobKeyDetails display reads — decoupled from any
// one page's job shape so every view passes only what it already has.
export type JobKeyDetailsData = {
  work_mode: string;
  location: string | null;
  address_line: string | null;
  postcode: string | null;
  location_area: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  days_on_site: number | null;
  scheduled_at: string | null;
  ends_at: string | null;
  schedule_type?: string | null;
  estimated_minutes?: number | null;
};

type JobScheduleView = { heading: string; value: string; note: string | null };

// Single source of truth for how a job's schedule reads. In-person jobs carry
// clock times whose meaning depends on schedule_type: a fixed "Shift" (work
// these exact hours) vs a "Complete anytime" window (fixed price for the task,
// finish it any time in the window — with an optional duration estimate).
// Online/hybrid jobs show plain dates. Returns null when there's no schedule.
export function jobScheduleLabel(job: {
  work_mode: string;
  scheduled_at: string | null;
  ends_at: string | null;
  schedule_type?: string | null;
  estimated_minutes?: number | null;
}): JobScheduleView | null {
  if (!job.scheduled_at) return null;
  const start = new Date(job.scheduled_at);
  const end = job.ends_at ? new Date(job.ends_at) : null;
  const inPerson = job.work_mode === "in_person";

  let value: string;
  if (inPerson) {
    const startStr = start.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    value = end
      ? `${startStr} → ${end.toLocaleString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : startStr;
    const type: ScheduleType = job.schedule_type === "shift" ? "shift" : "window";
    if (type === "shift") return { heading: "Shift", value, note: null };
    const note =
      job.estimated_minutes != null
        ? `Estimated ${formatEstimatedMinutes(job.estimated_minutes)}`
        : null;
    return { heading: "Complete anytime", value, note };
  }

  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const startStr = start.toLocaleDateString("en-GB", dateOpts);
  value = end ? `${startStr} → ${end.toLocaleDateString("en-GB", dateOpts)}` : startStr;
  return { heading: "Dates", value, note: null };
}

// Exact address is sensitive. Only the owner, or the assigned Kinglancer once
// escrow is funded (the job has left 'open'), may see the full address + map;
// everyone else sees the public area label only. Single source of truth.
const LOCATION_FUNDED_STATUSES = [
  "in_progress",
  "completed",
  "approved",
  "disputed",
];

export function canSeeExactLocation(args: {
  status: string;
  isOwner: boolean;
  isAssignedKinglancer: boolean;
}): boolean {
  if (args.isOwner) return true;
  return (
    args.isAssignedKinglancer &&
    LOCATION_FUNDED_STATUSES.includes(args.status)
  );
}
