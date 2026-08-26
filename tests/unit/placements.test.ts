import { describe, it, expect } from "vitest";
import {
  parsePlacementInput,
  openPlacementLimit,
  activeParticipantLimit,
  placementNeedsManualReview,
  managedMonthlyAmount,
  monthlyPaymentCount,
  placementMonthlyAmounts,
  derivePlacementView,
  PlacementError,
} from "@/lib/placements";
import { JOB_CATEGORIES } from "@/lib/job-categories";

const category = (JOB_CATEGORIES as readonly string[])[0];

const valid = {
  title: "Media team assistant",
  summary: "Support the media team with production during services.",
  categories: [category],
  contribution: "Assist with filming and editing during weekly services.",
  location: "London",
  work_mode: "onsite",
  compensation_types: ["reference"],
  compensation_details: { reference: "A written reference on completion." },
  weekly_hours: 8,
  start_date: "2026-09-01",
  end_date: "2026-10-27",
};

describe("derivePlacementView", () => {
  const ctx = { activeCount: 0, canDelete: true };
  const kinds = (status: string, c = ctx) =>
    derivePlacementView(status, c).actions.map((a) => a.kind);

  it("draft offers only Publish", () => {
    expect(kinds("draft")).toEqual(["publish"]);
  });

  it("a placement in review can only be withdrawn (not 'stop taking applicants')", () => {
    const view = derivePlacementView("pending_review", ctx);
    expect(view.actions.map((a) => a.kind)).toEqual(["cancel"]);
    expect(view.actions[0].label).toBe("Withdraw from review");
    expect(view.pill.label).toBe("In review");
  });

  it("an open placement can stop taking applicants", () => {
    const view = derivePlacementView("open", ctx);
    expect(view.actions[0].kind).toBe("cancel");
    expect(view.actions[0].label).toBe("Stop taking applicants");
  });

  it("a wound-down placement can be reposted, hidden and deleted (owner/admin)", () => {
    expect(kinds("cancelled", { activeCount: 0, canDelete: true })).toEqual([
      "repost",
      "archive",
      "delete",
    ]);
    expect(kinds("cancelled", { activeCount: 0, canDelete: false })).toEqual([
      "repost",
      "archive",
    ]);
  });

  it("an ended placement with active participants offers no listing actions", () => {
    const view = derivePlacementView("cancelled", {
      activeCount: 1,
      canDelete: true,
    });
    expect(view.actions).toEqual([]);
    expect(view.pill.label).toBe("No longer taking applicants");
  });
});

describe("parsePlacementInput", () => {
  it("accepts a valid placement and normalises fields", () => {
    const result = parsePlacementInput(valid);
    expect(result.title).toBe("Media team assistant");
    expect(result.categories).toEqual([category]);
    expect(result.weeklyHours).toBe(8);
    expect(result.durationWeeks).toBe(8);
    expect(result.isRemote).toBe(false);
    expect(result.workMode).toBe("onsite");
  });

  it("rejects a too-short title", () => {
    expect(() => parsePlacementInput({ ...valid, title: "ab" })).toThrow(
      PlacementError,
    );
  });

  it("requires the placement to offer at least one thing in return", () => {
    expect(() =>
      parsePlacementInput({
        ...valid,
        compensation_types: [],
        compensation_details: {},
      }),
    ).toThrow(/at least one thing/);
  });

  it("caps weekly hours at 20", () => {
    expect(() => parsePlacementInput({ ...valid, weekly_hours: 24 })).toThrow(
      /Weekly hours/,
    );
  });

  it("rejects a placement longer than the maximum weeks", () => {
    expect(() =>
      parsePlacementInput({
        ...valid,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      }),
    ).toThrow(/6 months/);
  });

  it("requires a start and end date", () => {
    expect(() => parsePlacementInput({ ...valid, start_date: "" })).toThrow(
      /start date/,
    );
    expect(() => parsePlacementInput({ ...valid, end_date: "" })).toThrow(
      /end date/,
    );
  });

  it("rejects an end date on or before the start", () => {
    expect(() =>
      parsePlacementInput({
        ...valid,
        start_date: "2026-10-01",
        end_date: "2026-09-01",
      }),
    ).toThrow(/after the start/);
  });

  it("requires at least one category", () => {
    expect(() => parsePlacementInput({ ...valid, categories: [] })).toThrow(
      /category/,
    );
  });

  it("rejects an unknown category", () => {
    expect(() =>
      parsePlacementInput({ ...valid, categories: ["Not A Category"] }),
    ).toThrow(/invalid/);
  });

  it("requires a location for on-site placements", () => {
    expect(() =>
      parsePlacementInput({ ...valid, work_mode: "onsite", location: "" }),
    ).toThrow(/location/);
  });

  it("requires days on-site for hybrid placements", () => {
    expect(() =>
      parsePlacementInput({
        ...valid,
        work_mode: "hybrid",
        location: "London",
      }),
    ).toThrow(/days on-site/);
  });

  it("accepts a hybrid placement with days on-site", () => {
    const result = parsePlacementInput({
      ...valid,
      work_mode: "hybrid",
      location: "London",
      days_on_site: 3,
    });
    expect(result.workMode).toBe("hybrid");
    expect(result.daysOnSite).toBe(3);
  });

  it("requires an explanation when compensation includes 'other'", () => {
    expect(() =>
      parsePlacementInput({ ...valid, compensation_types: ["other"] }),
    ).toThrow(/Other/);
  });

  it("rejects an unknown compensation option", () => {
    expect(() =>
      parsePlacementInput({ ...valid, compensation_types: ["crypto"] }),
    ).toThrow(/compensation/);
  });

  it("requires details for a non-money compensation", () => {
    expect(() =>
      parsePlacementInput({ ...valid, compensation_types: ["certificate"] }),
    ).toThrow(/Certificate/);
  });

  it("requires an amount and cadence for money compensation", () => {
    expect(() =>
      parsePlacementInput({
        ...valid,
        compensation_types: ["money"],
        compensation_details: { money: { cadence: "per_week" } },
      }),
    ).toThrow(/amount/);
    expect(() =>
      parsePlacementInput({
        ...valid,
        compensation_types: ["money"],
        compensation_details: { money: { amount: 30 } },
      }),
    ).toThrow(/how often/);
  });

  it("accepts money compensation with an amount and cadence", () => {
    const result = parsePlacementInput({
      ...valid,
      compensation_types: ["money"],
      compensation_details: { money: { amount: 30, cadence: "per_week" } },
    });
    expect(result.compensationDetails.money).toEqual({
      amount: 30,
      cadence: "per_week",
    });
  });
});

describe("openPlacementLimit", () => {
  it("returns the plan's placement allowance", () => {
    expect(openPlacementLimit("starter")).toBe(2);
    expect(openPlacementLimit("growth")).toBe(6);
    expect(openPlacementLimit("scale")).toBe(20);
  });
});

describe("activeParticipantLimit", () => {
  it("returns the plan's participant allowance", () => {
    expect(activeParticipantLimit("starter")).toBe(3);
    expect(activeParticipantLimit("growth")).toBe(10);
    expect(activeParticipantLimit("scale")).toBe(30);
  });
});

describe("placementNeedsManualReview", () => {
  it("flags higher-risk categories", () => {
    expect(placementNeedsManualReview(["Cleaning & Maintenance"])).toBe(true);
    expect(placementNeedsManualReview(["Construction & Trade"])).toBe(true);
    expect(
      placementNeedsManualReview(["Design & Creative", "Construction & Trade"]),
    ).toBe(true);
  });

  it("does not flag ordinary categories", () => {
    expect(placementNeedsManualReview(["Design & Creative"])).toBe(false);
    expect(placementNeedsManualReview(["Technology & IT"])).toBe(false);
    expect(placementNeedsManualReview([])).toBe(false);
  });
});

describe("managedMonthlyAmount", () => {
  it("returns the money amount for a managed money placement", () => {
    expect(
      managedMonthlyAmount({
        payment_mode: "managed",
        compensation_types: ["money"],
        compensation_details: { money: { amount: 500, cadence: "per_month" } },
      }),
    ).toBe(500);
  });

  it("is null for direct placements", () => {
    expect(
      managedMonthlyAmount({
        payment_mode: "direct",
        compensation_types: ["money"],
        compensation_details: { money: { amount: 500 } },
      }),
    ).toBeNull();
  });

  it("is null when there is no money compensation", () => {
    expect(
      managedMonthlyAmount({
        payment_mode: "managed",
        compensation_types: ["reference"],
        compensation_details: { reference: "A written reference" },
      }),
    ).toBeNull();
  });
});

describe("monthlyPaymentCount", () => {
  it("is at least one month", () => {
    expect(monthlyPaymentCount(1)).toBe(1);
    expect(monthlyPaymentCount(4)).toBe(1);
  });

  it("scales with duration", () => {
    expect(monthlyPaymentCount(8)).toBe(2);
    expect(monthlyPaymentCount(26)).toBe(6);
  });
});

describe("placementMonthlyAmounts", () => {
  it("bills whole months at the monthly rate", () => {
    const a = placementMonthlyAmounts(26, 500);
    expect(a).toHaveLength(6);
    expect(a.slice(0, 5)).toEqual([500, 500, 500, 500, 500]);
  });

  it("prorates the final part-month", () => {
    const a = placementMonthlyAmounts(5, 500); // ~1.15 months
    expect(a).toHaveLength(2);
    expect(a[0]).toBe(500);
    expect(a[1]).toBeGreaterThan(60);
    expect(a[1]).toBeLessThan(90);
  });

  it("bills a sub-month placement entirely pro-rata", () => {
    const a = placementMonthlyAmounts(2, 500); // ~0.46 months
    expect(a).toHaveLength(1);
    expect(a[0]).toBeGreaterThan(200);
    expect(a[0]).toBeLessThan(260);
  });
});
