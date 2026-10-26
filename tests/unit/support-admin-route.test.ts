import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  role: "admin",
  session: true,
  update: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { role: mocks.role } }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/admin-auth", () => ({
  hasValidAdminSession: async () => mocks.session,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      update: (value: unknown) => {
        mocks.update(value);
        return {
          eq: () => ({
            eq: () => ({ select: () => ({ maybeSingle: mocks.save }) }),
          }),
        };
      },
    }),
  }),
}));
import { PATCH } from "@/app/api/admin/support/[id]/route";
const id = "ad463989-195f-4f9b-9be4-765446da66af";
function change() {
  return PATCH(
    new Request(`https://kingshire.uk/api/admin/support/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress", expectedStatus: "new" }),
    }),
    { params: Promise.resolve({ id }) },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: "owner" };
  mocks.role = "admin";
  mocks.session = true;
  mocks.save.mockResolvedValue({ data: { id }, error: null });
});
describe("private customer enquiry updates", () => {
  it("requires a signed-in user", async () => {
    mocks.user = null;
    expect((await change()).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires both the admin role and the extra admin session", async () => {
    mocks.role = "client";
    expect((await change()).status).toBe(403);
    mocks.role = "admin";
    mocks.session = false;
    expect((await change()).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a stale update rather than claiming it was saved", async () => {
    mocks.save.mockResolvedValue({ data: null, error: null });
    expect((await change()).status).toBe(409);
  });
  it("saves a valid operator update", async () => {
    expect((await change()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ status: "in_progress" });
  });
});
