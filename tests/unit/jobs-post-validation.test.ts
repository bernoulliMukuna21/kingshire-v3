import { describe, it, expect } from "vitest";
import { validateJobPostShape } from "@/app/api/jobs/validateJobPostShape";

const baseGig = {
  isRole: false,
  titleStr: "Clean a flat",
  descStr: "Deep clean a 2-bed flat before check-in.",
  categories: ["Cleaning & Maintenance"],
  budget: "25",
  budgetNum: 25,
  normalizedBudget: 25,
  employment_type: undefined,
  pay_cadence: undefined,
  pay_negotiable: undefined,
  pay_amount: undefined,
  settlement_mode: undefined,
  organisationId: null,
  deadline: undefined,
};

describe("validateJobPostShape", () => {
  it("passes a valid gig", () => {
    expect(validateJobPostShape(baseGig)).toBeNull();
  });

  it("rejects a missing title", () => {
    const result = validateJobPostShape({ ...baseGig, titleStr: "" });
    expect(result?.status).toBe(400);
  });

  it("rejects a gig budget below the minimum", () => {
    const result = validateJobPostShape({
      ...baseGig,
      budget: "1",
      budgetNum: 1,
      normalizedBudget: 1,
    });
    expect(result?.error).toMatch(/Budget must be between/);
  });

  it("rejects an unknown category", () => {
    const result = validateJobPostShape({
      ...baseGig,
      categories: ["Not a real category"],
    });
    expect(result?.error).toBe("Invalid category.");
  });

  it("requires an organisation for a role posting", () => {
    const result = validateJobPostShape({
      ...baseGig,
      isRole: true,
      employment_type: "permanent",
      pay_cadence: "monthly",
      pay_amount: 50,
      settlement_mode: "managed",
      organisationId: null,
    });
    expect(result?.error).toBe(
      "Organisation roles must belong to an organisation.",
    );
  });

  it("passes a valid role posting", () => {
    const result = validateJobPostShape({
      ...baseGig,
      isRole: true,
      employment_type: "permanent",
      pay_cadence: "monthly",
      pay_amount: 50,
      settlement_mode: "managed",
      organisationId: "org-1",
    });
    expect(result).toBeNull();
  });

  it("rejects a negotiable-pay role missing settlement mode", () => {
    const result = validateJobPostShape({
      ...baseGig,
      isRole: true,
      employment_type: "permanent",
      pay_negotiable: true,
      settlement_mode: undefined,
      organisationId: "org-1",
    });
    expect(result?.error).toBe(
      "Choose how the recurring payment will be settled.",
    );
  });

  it("rejects a past deadline", () => {
    const result = validateJobPostShape({
      ...baseGig,
      deadline: "2000-01-01",
    });
    expect(result?.error).toBe("Deadline must be today or a future date.");
  });
});
