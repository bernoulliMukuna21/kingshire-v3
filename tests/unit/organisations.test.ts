import { describe, expect, it } from "vitest";
import {
  canManageJob,
  hasOrganisationPermission,
} from "@/lib/organisations";
import { vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    }),
  }),
}));

describe("organisation permissions", () => {
  it("gives owners full Phase 1 control", () => {
    expect(hasOrganisationPermission("owner", "manage_billing")).toBe(true);
    expect(hasOrganisationPermission("owner", "delete_organisation")).toBe(
      true,
    );
  });

  it("lets admins manage the workspace and members without owner powers", () => {
    expect(hasOrganisationPermission("admin", "manage_organisation")).toBe(
      true,
    );
    expect(hasOrganisationPermission("admin", "manage_members")).toBe(true);
    expect(hasOrganisationPermission("admin", "manage_billing")).toBe(false);
    expect(hasOrganisationPermission("admin", "delete_organisation")).toBe(
      false,
    );
  });

  it("limits members to jobs and applicants", () => {
    expect(hasOrganisationPermission("member", "manage_jobs")).toBe(true);
    expect(hasOrganisationPermission("member", "manage_applicants")).toBe(
      true,
    );
    expect(hasOrganisationPermission("member", "manage_members")).toBe(false);
  });

  it("does not let a removed poster retain access to an Organisation job", async () => {
    await expect(
      canManageJob(
        {
          client_id: "former-member",
          organisation_id: "organisation-id",
        },
        "former-member",
      ),
    ).resolves.toBe(false);
  });

  it("keeps personal jobs manageable by their client", async () => {
    await expect(
      canManageJob(
        { client_id: "client-id", organisation_id: null },
        "client-id",
      ),
    ).resolves.toBe(true);
  });
});
