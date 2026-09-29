import { JOB_CATEGORIES } from "@/lib/job-categories";
import { hasValidCurrencyPrecision } from "@/lib/validation";
import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import { meetsMinimumPeriodCharge } from "@/lib/settlement/fees";
import type { SettlementMode } from "@/lib/settlement/types";

export type JobPostError = { error: string; status: number };

/** Field-shape checks with no DB/network calls — title/description length,
 * budget shape, categories, role-only fields, deadline. Order matches the
 * original inline checks so error-message priority is unchanged. */
export function validateJobPostShape(input: {
  isRole: boolean;
  titleStr: string;
  descStr: string;
  categories: unknown;
  budget: unknown;
  budgetNum: number;
  normalizedBudget: number;
  employment_type: unknown;
  pay_cadence: unknown;
  pay_negotiable: unknown;
  pay_amount: unknown;
  settlement_mode: unknown;
  organisationId: string | null;
  deadline: unknown;
}): JobPostError | null {
  const {
    isRole,
    titleStr,
    descStr,
    categories,
    budget,
    budgetNum,
    normalizedBudget,
    employment_type,
    pay_cadence,
    pay_negotiable,
    pay_amount,
    settlement_mode,
    organisationId,
    deadline,
  } = input;

  if (
    !titleStr ||
    !descStr ||
    !(categories as unknown[] | undefined)?.length ||
    (!isRole && !budget)
  )
    return { error: "Missing required fields", status: 400 };
  if (titleStr.length < 3 || titleStr.length > 120)
    return {
      error: "Title must be between 3 and 120 characters.",
      status: 400,
    };
  if (descStr.length < 10 || descStr.length > 500)
    return {
      error: "Description must be between 10 and 500 characters.",
      status: 400,
    };
  if (
    (!isRole && !Number.isFinite(budgetNum)) ||
    (!isRole && !hasValidCurrencyPrecision(String(budget))) ||
    (!isRole && normalizedBudget < MIN_JOB_BUDGET_GBP) ||
    (!isRole && normalizedBudget > 50000)
  )
    return {
      error: `Budget must be between £${MIN_JOB_BUDGET_GBP} and £50,000 with up to 2 decimals.`,
      status: 400,
    };
  if (
    !Array.isArray(categories) ||
    categories.some(
      (c: string) => !(JOB_CATEGORIES as readonly string[]).includes(c),
    )
  )
    return { error: "Invalid category.", status: 400 };

  if (isRole) {
    if (!organisationId)
      return {
        error: "Organisation roles must belong to an organisation.",
        status: 400,
      };
    if (!["permanent", "temporary"].includes(employment_type as string))
      return {
        error: "Choose whether the role is permanent or temporary.",
        status: 400,
      };
    if (
      !["weekly", "monthly"].includes(pay_cadence as string) &&
      !pay_negotiable
    )
      return {
        error: "Choose weekly or monthly pay, or discuss pay at interview.",
        status: 400,
      };
    if (!["managed", "direct"].includes(settlement_mode as string))
      return {
        error: "Choose how the recurring payment will be settled.",
        status: 400,
      };
    if (
      !pay_negotiable &&
      (!Number.isFinite(Number(pay_amount)) ||
        !meetsMinimumPeriodCharge(Number(pay_amount), settlement_mode as SettlementMode))
    )
      return {
        error: `The recurring charge must be at least £${MIN_JOB_BUDGET_GBP} per period. Direct settlement only charges the facilitation fee — raise the pay amount or switch to managed settlement.`,
        status: 400,
      };
  }
  if (deadline) {
    const d = new Date(deadline as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d < today)
      return {
        error: "Deadline must be today or a future date.",
        status: 400,
      };
  }

  return null;
}
