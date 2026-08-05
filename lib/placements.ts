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

export type PlacementInput = {
  title: string;
  summary: string;
  categories: string[];
  contribution: string;
  reward: string;
  location: string | null;
  isRemote: boolean;
  weeklyHours: number;
  durationWeeks: number;
  startDate: string | null;
};

export class PlacementError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlacementError";
    this.status = status;
  }
}

export const MAX_PLACEMENT_WEEKLY_HOURS = 16;
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
  const reward = trimmed(b.reward);
  const location = trimmed(b.location) || null;
  const isRemote = b.is_remote === true;
  const weeklyHours = Number(b.weekly_hours);
  const durationWeeks = Number(b.duration_weeks);
  const startDate = trimmed(b.start_date) || null;
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
  if (reward.length < 10 || reward.length > 4000) {
    throw new PlacementError(
      "Describe what the participant will receive (10–4000 characters).",
    );
  }
  if (!categories.length) {
    throw new PlacementError("Select at least one category.");
  }
  if (categories.some((c) => !(JOB_CATEGORIES as readonly string[]).includes(c))) {
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
  if (
    !Number.isInteger(durationWeeks) ||
    durationWeeks < 1 ||
    durationWeeks > MAX_PLACEMENT_DURATION_WEEKS
  ) {
    throw new PlacementError(
      `Duration must be between 1 and ${MAX_PLACEMENT_DURATION_WEEKS} weeks.`,
    );
  }
  if (startDate && Number.isNaN(Date.parse(startDate))) {
    throw new PlacementError("Start date is invalid.");
  }

  return {
    title,
    summary,
    categories,
    contribution,
    reward,
    location,
    isRemote,
    weeklyHours,
    durationWeeks,
    startDate,
  };
}

/** Plan entitlement: how many placement listings may be open at once. */
export function openPlacementLimit(planId: OrganisationPlanId) {
  return getOrganisationPlan(planId).entitlements.paidPlacements;
}
