import { describe, expect, it, vi } from "vitest";

const due = vi.hoisted(() => vi.fn());
const engagement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/engagement-payments", () => ({
  getDueEngagementPayments: due,
  getEngagementPayments: vi.fn().mockResolvedValue([]),
  getEngagementPayment: vi.fn(),
  createEngagementPayments: vi.fn(),
  updateEngagementPaymentStatus: vi.fn(),
  getDisputedEngagementPayments: vi.fn().mockResolvedValue([]),
  getHeldEngagementPaymentsForOrganisation: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagement: engagement,
  getEngagementBySource: vi.fn(),
  createEngagement: vi.fn(),
}));

import { listDuePlacementPayments } from "@/lib/db/placement-payments";

describe("listDuePlacementPayments", () => {
  it("selects only due payments whose source is a Placement", async () => {
    due.mockResolvedValueOnce([
      { id: "p-placement", engagement_id: "e-placement" },
      { id: "p-role", engagement_id: "e-role" },
    ]);
    engagement
      .mockResolvedValueOnce({ source_kind: "placement" })
      .mockResolvedValueOnce({ source_kind: "org_role" });

    const result = await listDuePlacementPayments();
    expect(result.map((payment) => payment.id)).toEqual(["p-placement"]);
  });
});
