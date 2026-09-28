import { describe, expect, it } from "vitest";
import { anchoredPeriodEnd, dateOnly } from "@/lib/settlement/schedule";
import { settlementResponse } from "@/lib/settlement/http";

describe("anchored release dates", () => {
  it("preserves January 31 across a short February", () => {
    const anchor = new Date("2026-01-31T00:00:00Z");
    expect(dateOnly(anchoredPeriodEnd(anchor, "monthly", 1))).toBe(
      "2026-02-28",
    );
    expect(dateOnly(anchoredPeriodEnd(anchor, "monthly", 2))).toBe(
      "2026-03-31",
    );
  });
  it("preserves the anchor across leap February", () => {
    expect(
      dateOnly(anchoredPeriodEnd(new Date("2028-01-31"), "monthly", 2)),
    ).toBe("2028-03-31");
  });
});

describe("admin settlement results", () => {
  it.each(["pending_onboarding", "skipped", "not_eligible"] as const)(
    "does not claim success for %s",
    async (result) => {
      const response = settlementResponse(result);
      expect(response.status).toBe(409);
      expect((await response.json()).ok).toBe(false);
    },
  );
  it.each(["released", "already_transferred"] as const)(
    "reports confirmed outcome %s",
    (result) => {
      expect(settlementResponse(result).status).toBe(200);
    },
  );
});
