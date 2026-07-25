import { describe, expect, it, vi } from "vitest";
import { createOrganisation } from "@/modules/organisations/application/create-organisation";
import { acceptOrganisationInvitation } from "@/modules/organisations/application/accept-invitation";
import { inviteOrganisationMember } from "@/modules/organisations/application/invite-member";
import {
  removeOrganisationMember,
  updateOrganisationMemberRole,
} from "@/modules/organisations/application/manage-member";
import {
  deleteOrganisation,
  transferOrganisationOwnership,
  updateOrganisation,
} from "@/modules/organisations/application/update-organisation";
import { OrganisationError } from "@/modules/organisations/domain/errors";
import type { OrganisationRepository } from "@/modules/organisations/repositories/organisation-repository";
import { parseMemberRoleUpdate } from "@/modules/organisations/schemas/member-role";

function repository(
  overrides: Partial<OrganisationRepository> = {},
): OrganisationRepository {
  return {
    createWithOwner: vi.fn(async () => "organisation-id"),
    acceptInvitation: vi.fn(async () => "organisation-id"),
    findMembership: vi.fn(async () => null),
    updateProfile: vi.fn(async () => undefined),
    transferOwnership: vi.fn(async () => undefined),
    deleteIfAllowed: vi.fn(async () => undefined),
    createInvitation: vi.fn(async () => ({
      token: "invitation-token",
      expiresAt: "2026-08-01T00:00:00.000Z",
      organisationName: "Test Organisation",
      inviterName: "Owner",
    })),
    updateMemberRole: vi.fn(async () => undefined),
    removeMember: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("Organisation application services", () => {
  it("normalizes and passes valid creation data to one repository command", async () => {
    const repo = repository();
    await expect(
      createOrganisation(repo, {
        actorId: "owner-id",
        body: {
          name: "  Test Organisation ",
          organisation_type: "company",
          email: " CONTACT@EXAMPLE.COM ",
          country: "",
          website: "https://example.com",
        },
      }),
    ).resolves.toEqual({ organisationId: "organisation-id" });

    expect(repo.createWithOwner).toHaveBeenCalledWith(
      "owner-id",
      expect.objectContaining({
        name: "Test Organisation",
        email: "contact@example.com",
        country: "United Kingdom",
      }),
    );
  });

  it("rejects invalid Organisation input before persistence", async () => {
    const repo = repository();
    await expect(
      createOrganisation(repo, {
        actorId: "owner-id",
        body: {
          name: "T",
          organisation_type: "company",
          email: "not-an-email",
        },
      }),
    ).rejects.toBeInstanceOf(OrganisationError);
    expect(repo.createWithOwner).not.toHaveBeenCalled();
  });

  it("allows an Admin to invite a Member", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "admin-id",
        role: "admin" as const,
      })),
    });
    await expect(
      inviteOrganisationMember(repo, {
        organisationId: "organisation-id",
        actorId: "admin-id",
        body: { email: "member@example.com", role: "member" },
      }),
    ).resolves.toEqual(
      expect.objectContaining({ email: "member@example.com" }),
    );
  });

  it("prevents an Admin from inviting another Admin", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "admin-id",
        role: "admin" as const,
      })),
    });
    await expect(
      inviteOrganisationMember(repo, {
        organisationId: "organisation-id",
        actorId: "admin-id",
        body: { email: "admin@example.com", role: "admin" },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects a malformed invitation token before persistence", async () => {
    const repo = repository();
    await expect(
      acceptOrganisationInvitation(repo, {
        token: "not-a-uuid",
        actorId: "member-id",
        actorEmail: "member@example.com",
      }),
    ).rejects.toMatchObject({ code: "expired" });
    expect(repo.acceptInvitation).not.toHaveBeenCalled();
  });

  it("allows an Admin to update the Organisation profile", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "admin-id",
        role: "admin" as const,
      })),
    });
    await updateOrganisation(repo, {
      organisationId: "organisation-id",
      actorId: "admin-id",
      body: {
        name: "Updated Organisation",
        organisation_type: "charity",
        email: "contact@example.com",
      },
    });
    expect(repo.updateProfile).toHaveBeenCalledOnce();
  });

  it("prevents a Member from updating the Organisation profile", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "member-id",
        role: "member" as const,
      })),
    });
    await expect(
      updateOrganisation(repo, {
        organisationId: "organisation-id",
        actorId: "member-id",
        body: {},
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it("only allows the Owner to transfer ownership", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "admin-id",
        role: "admin" as const,
      })),
    });
    await expect(
      transferOrganisationOwnership(repo, {
        organisationId: "organisation-id",
        actorId: "admin-id",
        newOwnerId: "member-id",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.transferOwnership).not.toHaveBeenCalled();
  });

  it("delegates deletion to the transactional repository command for an Owner", async () => {
    const repo = repository({
      findMembership: vi.fn(async () => ({
        organisation_id: "organisation-id",
        user_id: "owner-id",
        role: "owner" as const,
      })),
    });
    await deleteOrganisation(repo, {
      organisationId: "organisation-id",
      actorId: "owner-id",
    });
    expect(repo.deleteIfAllowed).toHaveBeenCalledWith(
      "organisation-id",
      "owner-id",
    );
  });

  it("prevents an Admin from changing another Admin", async () => {
    const repo = repository({
      findMembership: vi.fn(async (_organisationId, userId) => ({
        organisation_id: "organisation-id",
        user_id: userId,
        role: "admin" as const,
      })),
    });
    await expect(
      updateOrganisationMemberRole(repo, {
        organisationId: "organisation-id",
        actorId: "admin-one",
        targetUserId: "admin-two",
        role: "member",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.updateMemberRole).not.toHaveBeenCalled();
  });

  it("prevents removal of the current Owner", async () => {
    const repo = repository({
      findMembership: vi.fn(async (_organisationId, userId) => ({
        organisation_id: "organisation-id",
        user_id: userId,
        role: userId === "owner-id" ? "owner" as const : "admin" as const,
      })),
    });
    await expect(
      removeOrganisationMember(repo, {
        organisationId: "organisation-id",
        actorId: "admin-id",
        targetUserId: "owner-id",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  it("rejects a missing member role instead of silently demoting", () => {
    expect(() => parseMemberRoleUpdate({})).toThrowError(
      "Select a valid Organisation role.",
    );
  });
});
