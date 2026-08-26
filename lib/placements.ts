import { JOB_CATEGORIES } from "@/lib/job-categories";
import {
  getOrganisationPlan,
  type OrganisationPlanId,
} from "@/modules/organisations/domain/plans";

export type PlacementStatus =
  | "draft"
  | "pending_review"
  | "open"
  | "closed"
  | "cancelled";

export type PlacementWorkMode = "remote" | "hybrid" | "onsite";

export const PLACEMENT_COMPENSATION_TYPES = [
  "money",
  "reference",
  "certificate",
  "mentoring",
  "training",
  "other",
] as const;

export type PlacementCompensationType =
  (typeof PLACEMENT_COMPENSATION_TYPES)[number];

export const COMPENSATION_LABELS: Record<string, string> = {
  money: "Money",
  reference: "Reference",
  certificate: "Certificate",
  mentoring: "Mentoring",
  training: "Training",
  other: "Other",
};

export const PLACEMENT_COMPENSATION_CADENCES = [
  "per_hour",
  "per_day",
  "per_week",
  "per_month",
  "one_off",
] as const;

export const COMPENSATION_CADENCE_LABELS: Record<string, string> = {
  per_hour: "per hour",
  per_day: "per day",
  per_week: "per week",
  per_month: "per month",
  one_off: "one-off",
};

export function formatCompensationDetail(
  type: string,
  detail: unknown,
): string {
  if (type === "money") {
    if (detail && typeof detail === "object") {
      const money = detail as { amount?: unknown; cadence?: unknown };
      const amount = Number(money.amount);
      const cadence =
        typeof money.cadence === "string"
          ? (COMPENSATION_CADENCE_LABELS[money.cadence] ?? "")
          : "";
      if (Number.isFinite(amount)) return `£${amount} ${cadence}`.trim();
    }
    return "";
  }
  return typeof detail === "string" ? detail : "";
}

// Human-readable compensation summary (used for agreement terms/display).
export function summarizePlacementCompensation(placement: {
  compensation_types: string[];
  compensation_details: Record<string, unknown> | null;
}): string {
  const details = placement.compensation_details ?? {};
  const parts = placement.compensation_types.map((type) => {
    const detail = formatCompensationDetail(type, details[type]);
    const label = COMPENSATION_LABELS[type] ?? type;
    return detail ? `${label} — ${detail}` : label;
  });
  return parts.join("; ");
}

// Monthly £ amount for a managed placement, or null if not managed/no money.
export function managedMonthlyAmount(placement: {
  payment_mode: string;
  compensation_types: string[];
  compensation_details: Record<string, unknown> | null;
}): number | null {
  if (placement.payment_mode !== "managed") return null;
  if (!placement.compensation_types.includes("money")) return null;
  const money = placement.compensation_details?.money;
  const amount =
    money && typeof money === "object"
      ? Number((money as { amount?: unknown }).amount)
      : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// Number of monthly payments a placement of the given duration spans.
export function monthlyPaymentCount(durationWeeks: number): number {
  return placementBillingFractions(durationWeeks).length;
}

const WEEKS_PER_MONTH = 4.345;
// Ignore a trailing part-month shorter than ~4 days rather than bill a sliver.
const PRORATE_MIN = 0.15;

/** Fractions of a month to bill: whole months (1) plus a prorated tail. */
function placementBillingFractions(durationWeeks: number): number[] {
  const totalMonths = durationWeeks / WEEKS_PER_MONTH;
  const fullMonths = Math.floor(totalMonths);
  const remainder = totalMonths - fullMonths;
  const fractions = Array.from({ length: fullMonths }, () => 1);
  if (remainder >= PRORATE_MIN) fractions.push(remainder);
  if (fractions.length === 0) fractions.push(remainder > 0 ? remainder : 1);
  return fractions;
}

/**
 * Monthly charge amounts (£) for a managed placement: full months at the
 * monthly rate, with the final part-month billed pro-rata.
 */
export function placementMonthlyAmounts(
  durationWeeks: number,
  monthlyAmount: number,
): number[] {
  return placementBillingFractions(durationWeeks).map((f) =>
    f === 1 ? monthlyAmount : Math.round(monthlyAmount * f * 100) / 100,
  );
}

export function placementWorkModeSummary(p: {
  work_mode: string;
  days_on_site: number | null;
  location: string | null;
}): string {
  if (p.work_mode === "hybrid") {
    const days = p.days_on_site ? ` (${p.days_on_site}d on-site/week)` : "";
    return `Hybrid${days}${p.location ? ` · ${p.location}` : ""}`;
  }
  if (p.work_mode === "onsite") {
    return `On-site${p.location ? ` · ${p.location}` : ""}`;
  }
  return "Remote";
}

export type PlacementInput = {
  title: string;
  summary: string;
  categories: string[];
  contribution: string;
  location: string | null;
  workMode: PlacementWorkMode;
  daysOnSite: number | null;
  isRemote: boolean;
  compensationTypes: string[];
  compensationDetails: Record<string, unknown>;
  weeklyHours: number;
  durationWeeks: number;
  startDate: string;
  endDate: string;
  paymentMode: "managed" | "direct";
};

export class PlacementError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlacementError";
    this.status = status;
  }
}

export const MAX_PLACEMENT_WEEKLY_HOURS = 20;

/**
 * Status pill for a placement, factoring in whether participants are still
 * active. A closed/cancelled placement that still has active participants
 * reads as "No longer taking applicants" (ongoing) rather than "Ended".
 */
export function placementStatusPill(
  status: string,
  activeCount: number,
): { label: string; className: string } {
  if (status === "cancelled" || status === "closed") {
    return activeCount > 0
      ? {
          label: "No longer taking applicants",
          className: "bg-amber-100 text-amber-700",
        }
      : { label: "Ended", className: "bg-slate-100 text-slate-500" };
  }
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
    pending_review: {
      label: "In review",
      className: "bg-amber-100 text-amber-700",
    },
    open: { label: "Open", className: "bg-emerald-100 text-emerald-700" },
  };
  return (
    map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" }
  );
}

// ── Placement lifecycle state machine ──────────────────────
// A single source of truth mapping a placement's stage (+ runtime context) to
// the management actions available. All UI reads from here, so adding/altering
// a stage happens in one place instead of scattered `status !== x` checks.

export type PlacementActionKind =
  | "publish"
  | "cancel"
  | "delete"
  | "repost"
  | "archive";

export interface PlacementActionSpec {
  kind: PlacementActionKind;
  label: string;
  tone: "primary" | "neutral" | "danger";
  icon: "rocket" | "lock" | "trash" | "repost" | "archive";
  confirm?: {
    title: string;
    bullets?: string[];
    note?: string;
    confirmLabel: string;
    danger?: boolean;
  };
}

export interface PlacementView {
  pill: { label: string; className: string };
  actions: PlacementActionSpec[];
}

const PUBLISH: PlacementActionSpec = {
  kind: "publish",
  label: "Publish",
  tone: "primary",
  icon: "rocket",
};

const REPOST: PlacementActionSpec = {
  kind: "repost",
  label: "Repost placement",
  tone: "primary",
  icon: "repost",
};

const DELETE: PlacementActionSpec = {
  kind: "delete",
  label: "Delete placement",
  tone: "danger",
  icon: "trash",
  confirm: {
    title: "Delete this placement?",
    bullets: ["This permanently removes the placement."],
    confirmLabel: "Delete placement",
    danger: true,
  },
};

const ARCHIVE: PlacementActionSpec = {
  kind: "archive",
  label: "Hide from my list",
  tone: "neutral",
  icon: "archive",
  confirm: {
    title: "Hide this placement?",
    bullets: [
      "Removes it from your organisation's lists.",
      "It stays on the Kinglancer's side and keeps all its history.",
    ],
    confirmLabel: "Hide placement",
  },
};

const STOP_APPLICANTS: PlacementActionSpec = {
  kind: "cancel",
  label: "Stop taking applicants",
  tone: "neutral",
  icon: "lock",
  confirm: {
    title: "Stop taking new applicants?",
    bullets: [
      "Removes it from public search — no new applications come in.",
      "Withdraws any offers you've sent that haven't been accepted yet.",
      "Anyone already active keeps going — you complete or end them individually.",
    ],
    note: "You can repost it later to open a fresh intake.",
    confirmLabel: "Stop taking applicants",
  },
};

const WITHDRAW_REVIEW: PlacementActionSpec = {
  kind: "cancel",
  label: "Withdraw from review",
  tone: "neutral",
  icon: "lock",
  confirm: {
    title: "Withdraw from review?",
    bullets: ["It won't go live and leaves the review queue."],
    note: "You can repost it later.",
    confirmLabel: "Withdraw",
  },
};

/**
 * The full management view (status pill + available actions) for a placement.
 * `activeCount` = participants still active; `canDelete` = viewer is owner/admin.
 */
export function derivePlacementView(
  status: string,
  ctx: { activeCount: number; canDelete: boolean },
): PlacementView {
  const pill = placementStatusPill(status, ctx.activeCount);
  const actions: PlacementActionSpec[] = [];

  switch (status) {
    case "draft":
      actions.push(PUBLISH);
      break;
    case "pending_review":
      actions.push(WITHDRAW_REVIEW);
      break;
    case "open":
      actions.push(STOP_APPLICANTS);
      break;
    case "closed":
    case "cancelled":
      // Only a fully wound-down placement (no active participants) can be
      // reposted, hidden or deleted.
      if (ctx.activeCount === 0) {
        actions.push(REPOST);
        actions.push(ARCHIVE);
        if (ctx.canDelete) actions.push(DELETE);
      }
      break;
  }

  return { pill, actions };
}
export const MAX_PLACEMENT_DURATION_WEEKS = 26;

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePlacementInput(body: unknown): PlacementInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PlacementError("Invalid placement details.");
  }
  const b = body as Record<string, unknown>;

  const title = trimmed(b.title);
  const summary = trimmed(b.summary);
  const contribution = trimmed(b.contribution);
  const location = trimmed(b.location) || null;
  const workMode = (trimmed(b.work_mode) || "remote") as PlacementWorkMode;
  const compensationTypes = Array.isArray(b.compensation_types)
    ? (b.compensation_types.filter((c) => typeof c === "string") as string[])
    : [];
  const detailsRaw =
    b.compensation_details &&
    typeof b.compensation_details === "object" &&
    !Array.isArray(b.compensation_details)
      ? (b.compensation_details as Record<string, unknown>)
      : {};
  const weeklyHours = Number(b.weekly_hours);
  const startDate = trimmed(b.start_date);
  const endDate = trimmed(b.end_date);
  const categories = Array.isArray(b.categories)
    ? (b.categories.filter((c) => typeof c === "string") as string[])
    : [];

  if (title.length < 3 || title.length > 140) {
    throw new PlacementError("Title must be between 3 and 140 characters.");
  }
  if (summary.length < 10 || summary.length > 4000) {
    throw new PlacementError("Summary must be between 10 and 4000 characters.");
  }
  if (contribution.length < 10 || contribution.length > 4000) {
    throw new PlacementError(
      "Describe what the participant will contribute (10–4000 characters).",
    );
  }
  if (!categories.length) {
    throw new PlacementError("Select at least one category.");
  }
  if (
    categories.some((c) => !(JOB_CATEGORIES as readonly string[]).includes(c))
  ) {
    throw new PlacementError("One or more categories are invalid.");
  }
  if (
    !Number.isInteger(weeklyHours) ||
    weeklyHours < 1 ||
    weeklyHours > MAX_PLACEMENT_WEEKLY_HOURS
  ) {
    throw new PlacementError(
      `Weekly hours must be between 1 and ${MAX_PLACEMENT_WEEKLY_HOURS}.`,
    );
  }
  if (!startDate || Number.isNaN(Date.parse(startDate))) {
    throw new PlacementError("Add a valid start date.");
  }
  if (!endDate || Number.isNaN(Date.parse(endDate))) {
    throw new PlacementError("Add a valid end date.");
  }
  const durationWeeks = Math.ceil(
    (Date.parse(endDate) - Date.parse(startDate)) / (7 * 24 * 60 * 60 * 1000),
  );
  if (durationWeeks < 1) {
    throw new PlacementError("The end date must be after the start date.");
  }
  if (durationWeeks > MAX_PLACEMENT_DURATION_WEEKS) {
    throw new PlacementError("A placement can run for at most 6 months.");
  }
  if (!(["remote", "hybrid", "onsite"] as string[]).includes(workMode)) {
    throw new PlacementError("Choose how the placement will be carried out.");
  }
  let daysOnSite: number | null = null;
  if (workMode === "hybrid") {
    daysOnSite = Number(b.days_on_site);
    if (!Number.isInteger(daysOnSite) || daysOnSite < 1 || daysOnSite > 6) {
      throw new PlacementError(
        "Set how many days on-site per week (1–6) for hybrid placements.",
      );
    }
  }
  if ((workMode === "hybrid" || workMode === "onsite") && !location) {
    throw new PlacementError(
      "Add a location for on-site or hybrid placements.",
    );
  }
  if (!compensationTypes.length) {
    throw new PlacementError(
      "A placement must offer the participant at least one thing in return.",
    );
  }
  if (
    compensationTypes.some(
      (t) => !(PLACEMENT_COMPENSATION_TYPES as readonly string[]).includes(t),
    )
  ) {
    throw new PlacementError("One or more compensation options are invalid.");
  }
  const compensationDetails: Record<string, unknown> = {};
  for (const type of compensationTypes) {
    if (type === "money") {
      const money =
        detailsRaw.money && typeof detailsRaw.money === "object"
          ? (detailsRaw.money as Record<string, unknown>)
          : {};
      const amount = Number(money.amount);
      const cadence = typeof money.cadence === "string" ? money.cadence : "";
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new PlacementError(
          "Enter the amount for the money compensation.",
        );
      }
      if (
        !(PLACEMENT_COMPENSATION_CADENCES as readonly string[]).includes(
          cadence,
        )
      ) {
        throw new PlacementError("Choose how often the money is paid.");
      }
      compensationDetails.money = { amount, cadence };
    } else {
      const detail =
        typeof detailsRaw[type] === "string"
          ? (detailsRaw[type] as string).trim()
          : "";
      const label = COMPENSATION_LABELS[type] ?? type;
      if (detail.length < 3) {
        throw new PlacementError(`Add details for the ${label} compensation.`);
      }
      if (detail.length > 500) {
        throw new PlacementError(
          `${label} details must be 500 characters or fewer.`,
        );
      }
      compensationDetails[type] = detail;
    }
  }

  return {
    title,
    summary,
    categories,
    contribution,
    location,
    workMode,
    daysOnSite,
    isRemote: workMode === "remote",
    compensationTypes,
    compensationDetails,
    weeklyHours,
    durationWeeks,
    startDate,
    endDate,
    // Any placement offering money is managed by KingsHire (we take the fee);
    // non-monetary placements are 'direct' (record only).
    paymentMode: compensationTypes.includes("money") ? "managed" : "direct",
  };
}

/** Plan entitlement: how many placement listings may be open at once. */
export function openPlacementLimit(planId: OrganisationPlanId) {
  return getOrganisationPlan(planId).entitlements.paidPlacements;
}

/** Plan entitlement: how many participants may be on placement at once. */
export function activeParticipantLimit(planId: OrganisationPlanId) {
  return getOrganisationPlan(planId).entitlements.activeParticipants;
}

// Higher-risk categories are always held for a manual safety review before a
// placement can go live, regardless of whether it is the organisation's first.
export const MANUAL_REVIEW_CATEGORIES = [
  "Cleaning & Maintenance",
  "Construction & Trade",
] as const;

export function placementNeedsManualReview(categories: string[]): boolean {
  return categories.some((c) =>
    (MANUAL_REVIEW_CATEGORIES as readonly string[]).includes(c),
  );
}
