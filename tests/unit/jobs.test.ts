import { describe, it, expect } from "vitest";
import { jobStatusPill } from "@/lib/jobs";

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
