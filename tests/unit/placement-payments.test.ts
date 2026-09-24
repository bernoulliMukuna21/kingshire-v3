import { describe, expect, it, vi } from "vitest";

const due = vi.hoisted(() => vi.fn());
const engagementsByIds = vi.hoisted(() => vi.fn());
const heldForOrg = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/engagement-payments", () => ({
  getDueEngagementPayments: due,
  getEngagementPayments: vi.fn().mockResolvedValue([]),
  getEngagementPayment: vi.fn(),
  createEngagementPayments: vi.fn(),
  updateEngagementPaymentStatus: vi.fn(),
  getDisputedEngagementPayments: vi.fn().mockResolvedValue([]),
  getHeldEngagementPaymentsForOrganisation: heldForOrg,
}));
vi.mock("@/lib/db/engagements", () => ({
  getEngagementsByIds: engagementsByIds,
  getEngagementBySource: vi.fn(),
  createEngagement: vi.fn(),
}));

const agreementRows = vi.hoisted(() => vi.fn());
const profileRows = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async () =>
          table === "placement_agreements"
            ? { data: agreementRows(), error: null }
            : { data: profileRows(), error: null },
      }),
    }),
  }),
}));

import {
  listDuePlacementPayments,
  listHeldPlacementPaymentsForOrg,
} from "@/lib/db/placement-payments";

describe("listDuePlacementPayments", () => {
  it("selects only due payments whose source is a Placement, using the real agreement id", async () => {
    due.mockResolvedValueOnce([
      { id: "p-placement", engagement_id: "e-placement" },
      { id: "p-role", engagement_id: "e-role" },
    ]);
    engagementsByIds.mockResolvedValueOnce(
      new Map([
        ["e-placement", { source_kind: "placement", source_id: "agr-1" }],
        ["e-role", { source_kind: "org_role", source_id: "job-1" }],
      ]),
    );

    const result = await listDuePlacementPayments();
    expect(result.map((payment) => payment.id)).toEqual(["p-placement"]);
    expect(result[0].agreement_id).toBe("agr-1");
  });
});

describe("listHeldPlacementPaymentsForOrg", () => {
  it("uses the real placement agreement id and enriches title + kinglancer name", async () => {
    heldForOrg.mockResolvedValueOnce([
      {
        id: "pay-1",
        engagement_id: "e-placement",
        kinglancer_id: "kl-1",
        worker_amount: 500,
        platform_fee_client: 12.5,
        platform_fee_kinglancer: 25,
        status: "held",
      },
    ]);
    engagementsByIds.mockResolvedValueOnce(
      new Map([
        ["e-placement", { source_kind: "placement", source_id: "agr-1" }],
      ]),
    );
    agreementRows.mockReturnValueOnce([
      {
        id: "agr-1",
        organisation: { name: "KingsHire Org" },
        placement: { title: "Media assistant" },
      },
    ]);
    profileRows.mockReturnValueOnce([{ id: "kl-1", full_name: "Ada" }]);

    const result = await listHeldPlacementPaymentsForOrg("org-1");
    expect(result).toHaveLength(1);
    // The link/back-reference must be the real placement_agreements.id, not
    // the engagement's own id — routes and action-centre links key off this.
    expect(result[0].agreement_id).toBe("agr-1");
    expect(result[0].agreement?.placement?.title).toBe("Media assistant");
    expect(result[0].kinglancer?.full_name).toBe("Ada");
  });
});
