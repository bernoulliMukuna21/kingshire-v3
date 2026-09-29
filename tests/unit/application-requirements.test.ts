import { describe, expect, it } from "vitest";
import { requiresApplicationCv } from "@/lib/application-requirements";

describe("application CV requirement", () => {
  it("requires CVs for organisation roles", () => {
    expect(requiresApplicationCv("role", "org-1")).toBe(true);
  });
  it("allows one-off gigs without a CV", () => {
    expect(requiresApplicationCv("gig", "org-1")).toBe(false);
  });
  it("allows personal jobs without a CV", () => {
    expect(requiresApplicationCv("role", null)).toBe(false);
    expect(requiresApplicationCv("placement", null)).toBe(false);
  });
});
