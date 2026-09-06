import { describe, it, expect } from "vitest";
import {
  buildClientJobItems,
  buildKinglancerJobItems,
  buildReviewItems,
  buildPlacementItems,
  buildOrgPlacementPaymentItems,
  buildOrgApplicationItems,
  type ClientActionJob,
  type KinglancerActionJob,
} from "@/lib/action-centre";
import type { PendingReviewJob } from "@/lib/db/reviews";
import type { KinglancerAgreement } from "@/lib/db/placements";
import type { OrgHeldPlacementPayment } from "@/lib/db/placement-payments";
import type { OrgPendingApplication } from "@/lib/db/placements";

function clientJob(overrides: Partial<ClientActionJob>): ClientActionJob {
  return {
    id: "job-1",
    title: "Job",
    status: "open",
    budget: 100,
    rate_type: "fixed",
    invited_kinglancer_id: null,
    direct_request_status: null,
    has_funded_transaction: false,
    counter_budget: null,
    counter_rate_type: null,
    counter_deadline: null,
    kinglancer: null,
    invited_kinglancer: null,
    ...overrides,
  };
}

function kinglancerJob(
  overrides: Partial<KinglancerActionJob>,
): KinglancerActionJob {
  return {
    id: "job-1",
    title: "Job",
    status: "open",
    budget: 100,
    rate_type: "fixed",
    direct_request_status: null,
    has_funded_transaction: false,
    client: null,
    ...overrides,
  };
}

function agreement(
  overrides: Partial<KinglancerAgreement>,
): KinglancerAgreement {
  const base = {
    id: "agr-1",
    status: "pending_acceptance",
    placement: { title: "Skilled Media Personnel", status: "open" },
  } as unknown as KinglancerAgreement;
  return { ...base, ...overrides };
}

describe("buildPlacementItems", () => {
  it("surfaces a pending placement offer as an action item (the dashboard/Action Centre drift bug)", () => {
    const items = buildPlacementItems([
      agreement({ status: "pending_acceptance" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("action");
    expect(items[0].badge).toBe("Placement offer");
    expect(items[0].id).toBe("agr-1:placement-offer");
  });

  it("does not surface an offer whose placement was cancelled", () => {
    const items = buildPlacementItems([
      agreement({
        status: "pending_acceptance",
        placement: { title: "X", status: "cancelled" },
      }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("surfaces pending_funding as a waiting item, not an action", () => {
    const items = buildPlacementItems([
      agreement({ status: "pending_funding" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("waiting");
  });

  it("ignores active/other agreement states", () => {
    expect(buildPlacementItems([agreement({ status: "active" })])).toHaveLength(
      0,
    );
  });
});

describe("buildClientJobItems", () => {
  it("flags completed work as a review-work action", () => {
    const items = buildClientJobItems([clientJob({ status: "completed" })], {});
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("action");
    expect(items[0].id).toBe("job-1:review-work");
  });

  it("flags open jobs with applicants as an action", () => {
    const items = buildClientJobItems([clientJob({ status: "open" })], {
      "job-1": 3,
    });
    expect(items[0].id).toBe("job-1:applicants");
    expect(items[0].description).toContain("3 applicants");
  });

  it("classifies a pending direct request as waiting", () => {
    const items = buildClientJobItems(
      [clientJob({ status: "open", direct_request_status: "pending" })],
      {},
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("waiting");
  });
});

describe("buildKinglancerJobItems", () => {
  it("flags a pending direct request as a reply action", () => {
    const items = buildKinglancerJobItems([
      kinglancerJob({ direct_request_status: "pending" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("action");
    expect(items[0].badge).toBe("Reply needed");
  });

  it("classifies changes_requested as waiting on client", () => {
    const items = buildKinglancerJobItems([
      kinglancerJob({ direct_request_status: "changes_requested" }),
    ]);
    expect(items[0].kind).toBe("waiting");
    expect(items[0].icon).toBe("alert");
  });
});

describe("buildReviewItems", () => {
  const pending: PendingReviewJob = {
    jobId: "job-9",
    jobTitle: "Logo design",
    counterpartName: "Ada",
    counterpartRole: "kinglancer",
    closesAt: null,
  };

  it("builds a role-scoped leave-review action", () => {
    const items = buildReviewItems([pending], "client");
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("action");
    expect(items[0].href).toBe("/dashboard/client/jobs/job-9#leave-review");
  });
});

describe("buildOrgPlacementPaymentItems", () => {
  it("surfaces a held escrow month as an approve/dispute action", () => {
    const payment = {
      id: "pay-1",
      agreement_id: "agr-1",
      amount: 500,
      kinglancer: { full_name: "Ada" },
      agreement: { placement: { title: "Media assistant" } },
    } as unknown as OrgHeldPlacementPayment;
    const items = buildOrgPlacementPaymentItems([payment]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("action");
    expect(items[0].badge).toBe("Review payment");
    expect(items[0].href).toBe("/dashboard/placements/agreements/agr-1");
    expect(items[0].title).toBe("Media assistant");
  });
});

describe("buildOrgApplicationItems", () => {
  it("groups pending applications per placement into one action with a count", () => {
    const apps: OrgPendingApplication[] = [
      { placementId: "p1", placementTitle: "Media assistant" },
      { placementId: "p1", placementTitle: "Media assistant" },
      { placementId: "p2", placementTitle: "Sound tech" },
    ];
    const items = buildOrgApplicationItems(apps, "org-1");
    expect(items).toHaveLength(2);
    const p1 = items.find((i) => i.id === "p1:placement-applicants")!;
    expect(p1.description).toContain("2 applicants");
    expect(p1.href).toBe("/dashboard/organisations/org-1/placements/p1");
    const p2 = items.find((i) => i.id === "p2:placement-applicants")!;
    expect(p2.description).toContain("1 applicant ");
  });
});
