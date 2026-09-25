import { lookupPostcode } from "@/lib/postcodes";
import type { JobPostError } from "./validateJobPostShape";

export type ResolvedJobSchedule = {
  resolvedWorkMode: "online" | "in_person" | "hybrid";
  addressStr: string;
  resolvedArea: string | null;
  resolvedPostcode: string | null;
  resolvedLat: number | null;
  resolvedLng: number | null;
  scheduledAtIso: string | null;
  endsAtIso: string | null;
  daysOnSite: number | null;
  resolvedScheduleType: "shift" | "window";
  resolvedEstimatedMinutes: number | null;
  resolvedDeadline: string | null;
};

/** Work-mode/location/schedule resolution — the one part of job-post
 * validation that hits the network (postcode geocoding). Order matches the
 * original inline checks so error-message priority is unchanged. */
export async function resolveJobSchedule(input: {
  isRole: boolean;
  employment_type: unknown;
  work_mode: unknown;
  scheduled_at: unknown;
  ends_at: unknown;
  days_on_site: unknown;
  schedule_type: unknown;
  estimated_minutes: unknown;
  postcode: unknown;
  address_line: unknown;
  deadline: unknown;
}): Promise<JobPostError | ResolvedJobSchedule> {
  const {
    isRole,
    employment_type,
    work_mode,
    scheduled_at,
    ends_at,
    days_on_site,
    schedule_type,
    estimated_minutes,
    postcode,
    address_line,
    deadline,
  } = input;

  const validWorkModes = ["online", "in_person", "hybrid"];
  if (!validWorkModes.includes(work_mode as string))
    return { error: "Choose where the job happens.", status: 400 };
  const resolvedWorkMode = work_mode as "online" | "in_person" | "hybrid";
  const addressStr =
    typeof address_line === "string" ? address_line.trim() : "";
  const postcodeStr = typeof postcode === "string" ? postcode.trim() : "";
  let resolvedArea: string | null = null;
  let resolvedPostcode: string | null = null;
  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;
  let scheduledAtIso: string | null = null;
  let endsAtIso: string | null = null;
  let daysOnSite: number | null = null;

  // Permanent roles have no end date; temporary roles must have a term.
  if (isRole && employment_type === "temporary") {
    const start = new Date(scheduled_at as string);
    const end = new Date(ends_at as string);
    if (!scheduled_at || isNaN(start.getTime()))
      return { error: "Add the role's start date.", status: 400 };
    if (!ends_at || isNaN(end.getTime()))
      return { error: "Add the role's end date.", status: 400 };
    if (end.getTime() < start.getTime())
      return {
        error: "The end date must be after the start date.",
        status: 400,
      };
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (!isRole && resolvedWorkMode === "online") {
    const start = new Date(scheduled_at as string);
    const end = new Date(ends_at as string);
    if (!scheduled_at || isNaN(start.getTime()))
      return { error: "Add the start date.", status: 400 };
    if (!ends_at || isNaN(end.getTime()))
      return { error: "Add the end date.", status: 400 };
    if (end.getTime() < start.getTime())
      return {
        error: "The end date must be after the start date.",
        status: 400,
      };
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (resolvedWorkMode === "in_person" || resolvedWorkMode === "hybrid") {
    if (!addressStr)
      return {
        error: "Add the street address for an in-person or hybrid job.",
        status: 400,
      };
    const geo = await lookupPostcode(postcodeStr);
    if (!geo)
      return { error: "Enter a valid UK postcode.", status: 400 };
    resolvedArea = geo.area;
    resolvedPostcode = geo.postcode;
    resolvedLat = geo.latitude;
    resolvedLng = geo.longitude;
  }
  if (!isRole && resolvedWorkMode === "in_person") {
    const startHasTime =
      typeof scheduled_at === "string" && /T\d{2}:\d{2}/.test(scheduled_at);
    const endHasTime =
      typeof ends_at === "string" && /T\d{2}:\d{2}/.test(ends_at);
    const start = new Date(scheduled_at as string);
    const end = new Date(ends_at as string);
    if (!startHasTime || isNaN(start.getTime()))
      return { error: "Add the start date and time.", status: 400 };
    if (!endHasTime || isNaN(end.getTime()))
      return { error: "Add the end date and time.", status: 400 };
    if (end.getTime() <= start.getTime())
      return {
        error: "The end time must be after the start time.",
        status: 400,
      };
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (resolvedWorkMode === "hybrid") {
    daysOnSite = Number(days_on_site);
    if (!Number.isInteger(daysOnSite) || daysOnSite < 1 || daysOnSite > 6)
      return {
        error: "Set how many days on-site per week (1–6) for a hybrid job.",
        status: 400,
      };
    if (isRole) {
      scheduledAtIso = null;
      endsAtIso = null;
    }
    const start = new Date(scheduled_at as string);
    const end = new Date(ends_at as string);
    if (!isRole && (!scheduled_at || isNaN(start.getTime())))
      return { error: "Add the start date.", status: 400 };
    if (!isRole && (!ends_at || isNaN(end.getTime())))
      return { error: "Add the end date.", status: 400 };
    if (!isRole && end.getTime() < start.getTime())
      return {
        error: "The end date must be after the start date.",
        status: 400,
      };
    if (!isRole) {
      scheduledAtIso = start.toISOString();
      endsAtIso = end.toISOString();
    }
  }

  // Schedule type only applies to in-person timed jobs: a fixed 'shift' vs a
  // 'window' to complete the task. Online/hybrid stay 'window'. The optional
  // duration estimate is kept only for in-person window jobs.
  const resolvedScheduleType =
    resolvedWorkMode === "in_person" && schedule_type === "shift"
      ? "shift"
      : "window";
  let resolvedEstimatedMinutes: number | null = null;
  if (
    resolvedWorkMode === "in_person" &&
    resolvedScheduleType === "window" &&
    estimated_minutes != null
  ) {
    const m = Number(estimated_minutes);
    if (Number.isInteger(m) && m >= 15 && m <= 1440)
      resolvedEstimatedMinutes = m;
  }

  // Every job now carries a start/end window; the end date backs the legacy
  // deadline column (job expiry, list displays) for continuity.
  const resolvedDeadline = endsAtIso
    ? endsAtIso.slice(0, 10)
    : (deadline as string) || null;

  return {
    resolvedWorkMode,
    addressStr,
    resolvedArea,
    resolvedPostcode,
    resolvedLat,
    resolvedLng,
    scheduledAtIso,
    endsAtIso,
    daysOnSite,
    resolvedScheduleType,
    resolvedEstimatedMinutes,
    resolvedDeadline,
  };
}
