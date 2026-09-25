import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import {
  CURRENCY_VALIDATION_MESSAGE,
  hasValidCurrencyPrecision,
} from "@/lib/validation";

export type PostJobFieldErrors = {
  title?: string;
  description?: string;
  categories?: string;
  budget?: string;
  address?: string;
  postcode?: string;
  scheduledAt?: string;
  endsAt?: string;
  daysOnSite?: string;
  workMode?: string;
  employmentType?: string;
  payAmount?: string;
  settlementMode?: string;
};

export type WorkMode = "online" | "in_person" | "hybrid" | "";

/** Mirrors the DB checks in app/api/jobs/route.ts — field-by-field, pulled
 * out of the component so it's testable without rendering a form. */
export function validatePostJobForm(input: {
  isRole: boolean;
  title: string;
  description: string;
  categories: string[];
  budget: string;
  totalBudget: number;
  payNegotiable: boolean;
  payAmount: string;
  employmentType: "permanent" | "temporary";
  roleStartsAt: string;
  roleEndsAt: string;
  workMode: WorkMode;
  scheduledAt: string;
  endsAt: string;
  addressLine: string;
  postcode: string;
  daysOnSite: string;
}): PostJobFieldErrors {
  const {
    isRole,
    title,
    description,
    categories,
    budget,
    totalBudget,
    payNegotiable,
    payAmount,
    employmentType,
    roleStartsAt,
    roleEndsAt,
    workMode,
    scheduledAt,
    endsAt,
    addressLine,
    postcode,
    daysOnSite,
  } = input;

  const fe: PostJobFieldErrors = {};
  if (!title.trim()) fe.title = "Job title is required.";
  if (!description.trim()) fe.description = "Description is required.";
  if (categories.length === 0)
    fe.categories = "Please select at least one category.";

  if (!isRole) {
    if (!budget || totalBudget <= 0)
      fe.budget = "Please enter a valid budget.";
    else if (!hasValidCurrencyPrecision(budget))
      fe.budget = CURRENCY_VALIDATION_MESSAGE;
    else if (totalBudget < MIN_JOB_BUDGET_GBP)
      fe.budget = `Minimum total budget is £${MIN_JOB_BUDGET_GBP}.`;
    else if (totalBudget > 50000)
      fe.budget = "Maximum total budget is £50,000.";
  } else {
    if (!payNegotiable) {
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount < MIN_JOB_BUDGET_GBP)
        fe.payAmount = `The recurring pay must be at least £${MIN_JOB_BUDGET_GBP} per period.`;
    }
    if (employmentType === "temporary") {
      if (!roleStartsAt) fe.scheduledAt = "Add the start date.";
      if (!roleEndsAt) fe.endsAt = "Add the end date.";
      else if (
        roleStartsAt &&
        new Date(roleEndsAt).getTime() < new Date(roleStartsAt).getTime()
      )
        fe.endsAt = "The end date must be after the start date.";
    }
  }

  if (!workMode) fe.workMode = "Choose where the job happens.";
  if (!isRole && workMode === "online") {
    if (!scheduledAt) fe.scheduledAt = "Add the start date.";
    if (!endsAt) fe.endsAt = "Add the end date.";
    else if (
      scheduledAt &&
      new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
    )
      fe.endsAt = "The end date must be after the start date.";
  }
  if (workMode === "in_person" || workMode === "hybrid") {
    if (!addressLine.trim()) fe.address = "Add the street address.";
    if (!postcode.trim()) fe.postcode = "Add the postcode.";
  }
  if (!isRole && workMode === "in_person") {
    if (!scheduledAt || !/T\d{2}:\d{2}/.test(scheduledAt))
      fe.scheduledAt = "Add the start date and time.";
    if (!endsAt || !/T\d{2}:\d{2}/.test(endsAt))
      fe.endsAt = "Add the end date and time.";
    else if (
      scheduledAt &&
      new Date(endsAt).getTime() <= new Date(scheduledAt).getTime()
    )
      fe.endsAt = "The end time must be after the start time.";
  }
  if (workMode === "hybrid") {
    const days = Number(daysOnSite);
    if (!Number.isInteger(days) || days < 1 || days > 6)
      fe.daysOnSite = "Set how many days on-site per week (1–6).";
    if (!isRole) {
      if (!scheduledAt) fe.scheduledAt = "Add the start date.";
      if (!endsAt) fe.endsAt = "Add the end date.";
      else if (
        scheduledAt &&
        new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
      )
        fe.endsAt = "The end date must be after the start date.";
    }
  }

  return fe;
}

/** Builds the JSON body for POST /api/jobs — same branching as the old
 * inline doPost, pulled out so the component only owns the fetch/redirect. */
export function buildJobPostPayload(input: {
  title: string;
  description: string;
  categories: string[];
  isRole: boolean;
  employmentType: "permanent" | "temporary";
  payCadence: "weekly" | "monthly";
  payAmount: string;
  payNegotiable: boolean;
  settlementMode: "managed" | "direct";
  roleStartsAt: string;
  roleEndsAt: string;
  totalBudget: number;
  preferredKinglancerId?: string | null;
  scheduledAt: string;
  endsAt: string;
  workMode: WorkMode;
  scheduleType: "shift" | "window";
  estimatedMinutes: string;
  addressLine: string;
  postcode: string;
  daysOnSite: string;
  organisationId?: string;
}): Record<string, unknown> {
  const {
    title,
    description,
    categories,
    isRole,
    employmentType,
    payCadence,
    payAmount,
    payNegotiable,
    settlementMode,
    roleStartsAt,
    roleEndsAt,
    totalBudget,
    preferredKinglancerId,
    scheduledAt,
    endsAt,
    workMode,
    scheduleType,
    estimatedMinutes,
    addressLine,
    postcode,
    daysOnSite,
    organisationId,
  } = input;

  return {
    title,
    description,
    categories,
    posting_type: isRole ? "role" : "gig",
    ...(isRole
      ? {
          employment_type: employmentType,
          pay_cadence: payNegotiable ? null : payCadence,
          pay_amount: payNegotiable ? null : Number(payAmount),
          pay_negotiable: payNegotiable,
          settlement_mode: payNegotiable ? "direct" : settlementMode,
          scheduled_at: employmentType === "temporary" ? roleStartsAt : null,
          ends_at: employmentType === "temporary" ? roleEndsAt : null,
        }
      : {
          budget: totalBudget,
          rate_type: "fixed",
          invited_kinglancer_id: preferredKinglancerId ?? null,
          scheduled_at: scheduledAt || null,
          ends_at: endsAt || null,
          schedule_type: workMode === "in_person" ? scheduleType : "window",
          estimated_minutes:
            workMode === "in_person" &&
            scheduleType === "window" &&
            estimatedMinutes
              ? Number(estimatedMinutes)
              : null,
        }),
    work_mode: workMode,
    address_line: workMode !== "online" ? addressLine.trim() : null,
    postcode: workMode !== "online" ? postcode.trim() : null,
    days_on_site: workMode === "hybrid" ? Number(daysOnSite) : null,
    organisation_id: organisationId || null,
  };
}
