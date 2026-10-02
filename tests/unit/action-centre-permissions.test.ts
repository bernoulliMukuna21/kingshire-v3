import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ membership: vi.fn(), jobs: vi.fn(), payments: vi.fn(), applications: vi.fn(), offers: vi.fn(), reviews: vi.fn() }));
vi.mock("@/lib/organisations", async () => {
  const { hasOrganisationPermission } = await import("@/modules/organisations/domain/permissions");
  return { getOrganisationMembership: mocks.membership, hasOrganisationPermission };
});
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/db/placements", () => ({ listPendingPlacementApplicationsForOrg: mocks.applications }));
vi.mock("@/lib/db/placement-payments", () => ({ listHeldPlacementPaymentsForOrg: mocks.payments }));
vi.mock("@/lib/db/engagements", () => ({ listOrgPendingRoleOffers: mocks.offers }));
vi.mock("@/lib/db/reviews", () => ({ getPendingReviewJobs: mocks.reviews }));
vi.mock("@/lib/action-centre/personal-providers", () => ({ fetchClientStyleJobItems: mocks.jobs }));
vi.mock("@/lib/action-centre/mappers", () => ({
  buildOrgApplicationItems: (items: unknown[]) => items,
  buildOrgPlacementPaymentItems: (items: unknown[]) => items,
  buildOrgRoleOfferItems: (items: unknown[]) => items,
  buildReviewItems: (items: unknown[]) => items,
}));
import { collectOrgActionItems } from "@/lib/action-centre/org-providers";

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [mocks.jobs, mocks.payments, mocks.applications, mocks.offers, mocks.reviews]) fn.mockResolvedValue([]);
});
describe("organisation action access", () => {
  it("does not read organisation data after membership is removed", async () => {
    mocks.membership.mockResolvedValue(null);
    expect(await collectOrgActionItems("org", "viewer")).toEqual([]);
    expect(mocks.membership).toHaveBeenCalledWith("org", "viewer");
    for (const fn of [mocks.jobs, mocks.payments, mocks.applications, mocks.offers, mocks.reviews]) expect(fn).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "member"])("uses existing job permissions for %s, including organisation reviews", async role => {
    mocks.membership.mockResolvedValue({ role });
    await collectOrgActionItems("org", "viewer");
    expect(mocks.jobs).toHaveBeenCalledWith({}, "organisation_id", "org");
    expect(mocks.applications).toHaveBeenCalledWith("org");
    expect(mocks.reviews).toHaveBeenCalledWith("viewer", "client", "org");
    expect(mocks.payments).toHaveBeenCalledWith("org");
  });
});
