import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/organisations", () => ({ requireOrganisationPermission: mocks.permission }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: mocks.from }) }));
import { getPendingReviewJobs } from "@/lib/db/reviews";
function query(rows: unknown[]) {
  const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() };
  for (const key of ["select", "eq", "is", "in", "order"] as const) q[key].mockReturnValue(q);
  q.range.mockResolvedValue({ data: rows, error: null });
  return q;
}
beforeEach(() => vi.clearAllMocks());
describe("review action scoping", () => {
  it("excludes organisation jobs from personal client review tasks", async () => {
    const jobs = query([]);
    mocks.from.mockReturnValue(jobs);
    await getPendingReviewJobs("viewer", "client");
    expect(jobs.eq).toHaveBeenCalledWith("client_id", "viewer");
    expect(jobs.is).toHaveBeenCalledWith("organisation_id", null);
  });
  it("keeps a Kinglancer's work across all employers", async () => {
    const jobs = query([]);
    mocks.from.mockReturnValue(jobs);
    await getPendingReviewJobs("worker", "kinglancer");
    expect(jobs.eq).toHaveBeenCalledWith("kinglancer_id", "worker");
    expect(jobs.is).not.toHaveBeenCalled();
  });
  it("does not read data without organisation permission", async () => {
    mocks.permission.mockResolvedValue(null);
    expect(await getPendingReviewJobs("viewer", "client", "org")).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("removes the task after another member submits the shared review", async () => {
    mocks.permission.mockResolvedValue({ role: "member" });
    const jobs = query([{ id: "job", title: "Job", client_id: "poster", counterpart: { full_name: "Worker" } }]);
    const tx = query([{ job_id: "job", released_at: new Date().toISOString() }]);
    const reviews = query([{ job_id: "job", reviewer_id: "poster" }]);
    mocks.from.mockImplementation((table: string) => ({ jobs, transactions: tx, reviews })[table as "jobs"]);
    expect(await getPendingReviewJobs("other-member", "client", "org")).toEqual([]);
    expect(jobs.eq).toHaveBeenCalledWith("organisation_id", "org");
    expect(jobs.eq).not.toHaveBeenCalledWith("client_id", "other-member");
    reviews.range.mockResolvedValue({ data: [], error: null });
    expect(await getPendingReviewJobs("other-member", "client", "org")).toHaveLength(1);
  });
});
