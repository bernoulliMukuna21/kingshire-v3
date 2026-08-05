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
  reward: "Mentoring, hands-on training and a verified experience record.",
  location: "London",
  is_remote: false,
  weekly_hours: 8,
  duration_weeks: 8,
  start_date: null,
};

describe("parsePlacementInput", () => {
  it("accepts a valid placement and normalises fields", () => {
    const result = parsePlacementInput(valid);
    expect(result.title).toBe("Media team assistant");
    expect(result.categories).toEqual([category]);
    expect(result.weeklyHours).toBe(8);
    expect(result.durationWeeks).toBe(8);
    expect(result.isRemote).toBe(false);
  });

  it("rejects a too-short title", () => {
    expect(() => parsePlacementInput({ ...valid, title: "ab" })).toThrow(
      PlacementError,
    );
  });

  it("caps weekly hours at 16", () => {
    expect(() =>
      parsePlacementInput({ ...valid, weekly_hours: 20 }),
    ).toThrow(/Weekly hours/);
  });

  it("caps duration at 26 weeks", () => {
    expect(() =>
      parsePlacementInput({ ...valid, duration_weeks: 30 }),
    ).toThrow(/Duration/);
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

  it("requires a meaningful reward description", () => {
    expect(() => parsePlacementInput({ ...valid, reward: "n/a" })).toThrow(
      PlacementError,
    );
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
