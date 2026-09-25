import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
import { resolveCvPath } from "@/lib/cv-storage";

describe("CV migration compatibility", () => {
  it("normalises this project's legacy URLs and preserves new object paths", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    expect(
      resolveCvPath(
        "placement-cvs",
        "https://project.supabase.co/storage/v1/object/public/placement-cvs/worker/cv.pdf",
        "worker",
      ),
    ).toBe("worker/cv.pdf");
    expect(
      resolveCvPath("job-application-cvs", "worker/cv.pdf", "worker"),
    ).toBe("worker/cv.pdf");
  });
  it("rejects foreign projects, other owners and traversal", () => {
    expect(
      resolveCvPath(
        "placement-cvs",
        "https://evil.test/storage/v1/object/public/placement-cvs/worker/cv.pdf",
        "worker",
      ),
    ).toBeNull();
    expect(resolveCvPath("placement-cvs", "other/cv.pdf", "worker")).toBeNull();
    expect(
      resolveCvPath("placement-cvs", "worker/../other/cv.pdf", "worker"),
    ).toBeNull();
    expect(
      resolveCvPath("placement-cvs", "worker/%2e%2e/other/cv.pdf", "worker"),
    ).toBeNull();
  });
});
