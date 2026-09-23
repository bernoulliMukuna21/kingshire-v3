import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "poster" as string | null,
  status: "active" as string | null,
  permission: true,
  subscriptionError: false,
  job: null as Record<string, unknown> | null,
}));
const upload = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
const createJob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) },
    from: () => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        single: async () => ({ data: { role: "client" } }),
        maybeSingle: async () => ({ data: { role: "client" } }),
        limit: async () => ({ data: [] }),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => table === "jobs"
          ? { data: state.job, error: null }
          : { data: state.status ? { status: state.status } : null, error: state.subscriptionError ? new Error("unavailable") : null },
      };
      return query;
    },
    storage: { from: () => ({ upload, remove, download }) },
  }),
}));
vi.mock("@/lib/db/jobs", () => ({ createJob, getOpenJobs: vi.fn() }));
vi.mock("@/lib/organisations", () => ({
  requireOrganisationPermission: async () => state.permission,
  canManageJob: async () => state.permission,
}));
vi.mock("@/lib/terms", () => ({ requireTermsAccepted: async () => true }));
vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: async () => undefined }));
vi.mock("@/lib/notifications", () => ({ emailJobAlert: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendPushToUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "@/app/api/jobs/route";
import { GET } from "@/app/api/jobs/[id]/attachment/route";

const payload = {
  title: "A detailed job", description: "A sufficiently detailed description.",
  categories: ["Cleaning & Maintenance"], budget: 100, work_mode: "online",
  scheduled_at: "2026-10-01", ends_at: "2026-10-03", organisation_id: "org",
};

function request(overrides: Record<string, unknown> = {}, file = new File(["%PDF-1.7 example"], "brief.pdf", { type: "application/pdf" })) {
  const form = new FormData();
  form.set("job", JSON.stringify({ ...payload, ...overrides }));
  form.set("attachment", file);
  return new Request("http://localhost/api/jobs", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { userId: "poster", status: "active", permission: true, subscriptionError: false, job: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  download.mockResolvedValue({ data: new Blob(["example"]), error: null });
  createJob.mockImplementation(async (data) => data);
});

describe("job attachment creation", () => {
  it("persists an uploaded document with an organisation/job-scoped path", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    const job = await response.json();
    expect(job.attachment.path).toMatch(new RegExp(`^org/${job.id}/`));
    expect(job.attachment.name).toBe("brief.pdf");
    expect(upload).toHaveBeenCalledOnce();
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ attachment: job.attachment }), { useServiceRole: true });
  });
  it("rejects personal uploads even for a subscribed user", async () => {
    expect((await POST(request({ organisation_id: null }))).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it.each([null, "past_due", "canceled", "paused"])("rejects unsubscribed organisations (%s)", async (status) => {
    state.status = status;
    expect((await POST(request())).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
  });
  it("rejects non-members before storage access", async () => {
    state.permission = false;
    expect((await POST(request())).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it("fails closed when subscription lookup fails", async () => {
    state.subscriptionError = true;
    expect((await POST(request())).status).toBe(503);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects unsupported files and client-supplied metadata", async () => {
    expect((await POST(request({}, new File(["html"], "brief.html")))).status).toBe(400);
    expect((await POST(request({ attachment: { path: "another/file" } }))).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it("does not create the job if uploading fails", async () => {
    upload.mockResolvedValue({ error: new Error("unavailable") });
    expect((await POST(request())).status).toBe(503);
    expect(createJob).not.toHaveBeenCalled();
  });
  it("cleans up the upload when job creation fails", async () => {
    createJob.mockRejectedValue(new Error("insert failed"));
    expect((await POST(request())).status).toBe(500);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });
  it("preserves ordinary JSON posting for grandfathered organisations", async () => {
    state.status = null;
    const response = await POST(new Request("http://localhost/api/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }));
    expect(response.status).toBe(201);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("job attachment downloads", () => {
  const get = () => GET(new Request("http://localhost/api/jobs/job/attachment"), { params: Promise.resolve({ id: "job" }) });
  beforeEach(() => {
    state.job = {
      id: "job", organisation_id: "org", client_id: "poster", kinglancer_id: null,
      invited_kinglancer_id: null,
      attachment: { path: "org/job/file", name: "brief.pdf", size: 100, contentType: "application/pdf" },
    };
  });
  it("allows public job documents and forces a non-cached download", async () => {
    state.userId = null;
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("denies anonymous and unrelated users for direct requests", async () => {
    state.job!.invited_kinglancer_id = "worker";
    state.userId = null;
    expect((await get()).status).toBe(404);
    state.userId = "unrelated";
    state.permission = false;
    expect((await get()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });
  it("allows the invited worker and authorised organisation members", async () => {
    state.job!.invited_kinglancer_id = "worker";
    state.permission = false;
    state.userId = "worker";
    expect((await get()).status).toBe(200);
    state.userId = "member";
    state.permission = true;
    expect((await get()).status).toBe(200);
  });
  it("rejects attachment paths belonging to a different job", async () => {
    state.job!.attachment = { path: "org/another-job/file", name: "brief.pdf", size: 100, contentType: "application/pdf" };
    expect((await get()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });
});
