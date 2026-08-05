import { describe, expect, it } from "vitest";
import {
  canManageJob,
  hasOrganisationPermission,
} from "@/lib/organisations";
import { vi } from "vitest";

// Membership lookup is keyed on the user id passed to the second `.eq()`.
// Only "current-member" resolves to an active membership; everyone else
// (removed members, outsiders) resolves to no membership.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: (_column: string, userId: string) => ({
            maybeSingle: async () =>
              userId === "current-member"
                ? {
                    data: {
                      organisation_id: "organisation-id",
                      user_id: "current-member",
                      role: "member",
                      organisation: { deleted_at: null },
                    },
                  }
                : { data: null },
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

  it("lets a current member manage an Organisation job they did not post (ORG-J08)", async () => {
    await expect(
      canManageJob(
        {
          client_id: "original-poster",
          organisation_id: "organisation-id",
        },
        "current-member",
      ),
    ).resolves.toBe(true);
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
