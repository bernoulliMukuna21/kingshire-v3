import { describe, it, expect } from "vitest";
import {
  jobStatusPill,
  jobScheduleLabel,
  formatEstimatedMinutes,
} from "@/lib/jobs";

describe("jobStatusPill", () => {
  it("uses one canonical label per status (no per-page drift)", () => {
    expect(jobStatusPill("completed").label).toBe("Awaiting approval");
    expect(jobStatusPill("approved").label).toBe("Completed");
    expect(jobStatusPill("in_progress").label).toBe("In progress");
    expect(jobStatusPill("open").label).toBe("Open");
  });

  it("falls back to the open pill for unknown statuses", () => {
    expect(jobStatusPill("nonsense").label).toBe("Open");
  });
});

describe("formatEstimatedMinutes", () => {
  it("formats sub-hour, whole-hour and half-hour durations", () => {
    expect(formatEstimatedMinutes(30)).toBe("30 min");
    expect(formatEstimatedMinutes(60)).toBe("1 hour");
    expect(formatEstimatedMinutes(90)).toBe("1.5 hours");
    expect(formatEstimatedMinutes(480)).toBe("8 hours");
  });
});

describe("jobScheduleLabel", () => {
  const start = "2026-09-07T09:44:00.000Z";
  const end = "2026-09-07T15:00:00.000Z";

  it("returns null when there's no schedule", () => {
    expect(
      jobScheduleLabel({ work_mode: "online", scheduled_at: null, ends_at: null }),
    ).toBeNull();
  });

  it("labels an in-person fixed shift", () => {
    const s = jobScheduleLabel({
      work_mode: "in_person",
      scheduled_at: start,
      ends_at: end,
      schedule_type: "shift",
    });
    expect(s?.heading).toBe("Shift");
    expect(s?.value).toContain("→");
    expect(s?.note).toBeNull();
  });

  it("labels an in-person flexible window with an estimate", () => {
    const s = jobScheduleLabel({
      work_mode: "in_person",
      scheduled_at: start,
      ends_at: end,
      schedule_type: "window",
      estimated_minutes: 120,
    });
    expect(s?.heading).toBe("Complete anytime");
    expect(s?.note).toBe("Estimated 2 hours");
  });

  it("defaults to a window and omits the note when no estimate", () => {
    const s = jobScheduleLabel({
      work_mode: "in_person",
      scheduled_at: start,
      ends_at: end,
    });
    expect(s?.heading).toBe("Complete anytime");
    expect(s?.note).toBeNull();
  });

  it("shows plain dates for non in-person jobs", () => {
    const s = jobScheduleLabel({
      work_mode: "online",
      scheduled_at: start,
      ends_at: end,
      schedule_type: "shift",
    });
    expect(s?.heading).toBe("Dates");
  });
});
