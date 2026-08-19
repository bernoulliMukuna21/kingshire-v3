import { describe, it, expect } from "vitest";
import {
  parsePlacementInput,
  openPlacementLimit,
  activeParticipantLimit,
  placementNeedsManualReview,
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
  compensation_types: [],
  weekly_hours: 8,
  start_date: "2026-09-01",
  end_date: "2026-10-27",
};

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

  it("caps weekly hours at 16", () => {
    expect(() => parsePlacementInput({ ...valid, weekly_hours: 20 })).toThrow(
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
      parsePlacementInput({ ...valid, work_mode: "hybrid", location: "London" }),
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
