import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), service: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/admin-dashboard", () => ({ requireAdminPage: mocks.guard }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.service,
}));
import { getAdminDb } from "@/lib/admin/access";
describe("admin read boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("does not instantiate an RLS-bypassing client before authorization", async () => {
    mocks.guard.mockRejectedValue(new Error("Forbidden"));
    await expect(getAdminDb()).rejects.toThrow("Forbidden");
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("returns the service client only after the signed administrator session is checked", async () => {
    const order: string[] = [];
    mocks.guard.mockImplementation(async () => {
      order.push("guard");
    });
    mocks.service.mockImplementation(() => {
      order.push("service");
      return { admin: true };
    });
    await expect(getAdminDb()).resolves.toEqual({ admin: true });
    expect(order).toEqual(["guard", "service"]);
  });
});
