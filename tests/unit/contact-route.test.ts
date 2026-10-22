import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  claim: vi.fn(),
  email: vi.fn(),
  tasks: [] as (() => Promise<void>)[],
}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
  after: (fn: () => Promise<void>) => mocks.tasks.push(fn),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      update: () => ({
        eq: () => ({
          is: () => ({ select: () => ({ maybeSingle: mocks.claim }) }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/notifications/core", () => ({ sendEmail: mocks.email }));
import { POST } from "@/app/api/contact/route";
const input = {
  id: "ad463989-195f-4f9b-9be4-765446da66af",
  topic: "account",
  name: "Ada",
  email: "ada@example.com",
  organisation: "",
  reference: "",
  message: "Please help me find this job.",
  sourcePath: "/jobs/test?private=1",
  website: "",
};
function request(body = input, origin = "https://kingshire.uk") {
  return new Request("https://kingshire.uk/api/contact", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.1",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tasks.length = 0;
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  vi.stubEnv("APP_URL", "https://kingshire.uk");
  mocks.rpc.mockResolvedValue({ data: input.id, error: null });
  mocks.claim.mockResolvedValue({ data: { ...input }, error: null });
});
describe("contact submission", () => {
  it("saves before acknowledging and keeps a raw IP out of the database", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: input.id });
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_source_path).toBe("/jobs/test");
    expect(args.p_sender_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(args)).not.toContain("192.0.2.1");
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.tasks).toHaveLength(1);
  });
  it("rejects cross-origin submissions before touching the database", async () => {
    expect((await POST(request(input, "https://evil.test"))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid email and honeypot submissions", async () => {
    expect((await POST(request({ ...input, email: "bad" }))).status).toBe(400);
    expect((await POST(request({ ...input, website: "spam" }))).status).toBe(
      400,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not acknowledge a failed save or send email", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42P01" } });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("returns a helpful response when the database connection fails", async () => {
    mocks.rpc.mockRejectedValue(new Error("Network offline"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("returns a rate limit without scheduling email", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("does not email again when a saved submission is retried", async () => {
    mocks.claim.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(201);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("keeps a saved enquiry successful when its email alert fails", async () => {
    mocks.email.mockRejectedValue(new Error("mail offline"));
    expect((await POST(request())).status).toBe(201);
    await expect(mocks.tasks[0]()).resolves.toBeUndefined();
  });
});
