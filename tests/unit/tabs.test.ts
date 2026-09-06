import { describe, it, expect } from "vitest";
import { resolveTab, countTabs, statusTabMatcher } from "@/lib/tabs";
import { applicationStatusPill } from "@/lib/applications";

const order = ["all", "open", "done"] as const;

describe("resolveTab", () => {
  it("returns the raw tab when it's a known one", () => {
    expect(resolveTab(order, "open", "all")).toBe("open");
  });

  it("falls back for unknown or missing tabs", () => {
    expect(resolveTab(order, "nope", "all")).toBe("all");
    expect(resolveTab(order, undefined, "all")).toBe("all");
  });
});

describe("countTabs + statusTabMatcher", () => {
  const statuses: Record<(typeof order)[number], string[]> = {
    all: [],
    open: ["open"],
    done: ["approved"],
  };
  const items = [
    { status: "open" },
    { status: "open" },
    { status: "approved" },
  ];

  it("counts by status; an empty status list means 'all'", () => {
    const counts = countTabs(order, items, statusTabMatcher(statuses));
    expect(counts.all).toBe(3);
    expect(counts.open).toBe(2);
    expect(counts.done).toBe(1);
  });
});

describe("applicationStatusPill", () => {
  it("labels the three application states", () => {
    expect(applicationStatusPill("pending").label).toBe("Pending review");
    expect(applicationStatusPill("accepted").label).toBe("Selected");
    expect(applicationStatusPill("rejected").label).toBe("Not selected");
  });

  it("falls back to pending for unknown states", () => {
    expect(applicationStatusPill("weird").label).toBe("Pending review");
  });
});
