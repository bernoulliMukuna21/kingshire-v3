import type {
  OrganisationMembership,
  OrganisationMemberRole,
  OrganisationProfileInput,
} from "../domain/types";

export interface OrganisationRepository {
  createWithOwner(
    actorId: string,
    profile: OrganisationProfileInput,
  ): Promise<string>;
  acceptInvitation(input: {
    token: string;
    actorId: string;
    actorEmail: string;
  }): Promise<string>;
  findMembership(
    organisationId: string,
    userId: string,
  ): Promise<OrganisationMembership | null>;
  updateProfile(
    organisationId: string,
    profile: OrganisationProfileInput,
  ): Promise<void>;
  transferOwnership(
    organisationId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<void>;
  deleteIfAllowed(organisationId: string, actorId: string): Promise<void>;
  createInvitation(input: {
    organisationId: string;
    actorId: string;
    email: string;
    role: Exclude<OrganisationMemberRole, "owner">;
  }): Promise<{
    token: string;
    expiresAt: string;
    organisationName: string;
    inviterName: string;
  }>;
  updateMemberRole(
    organisationId: string,
    userId: string,
    role: Exclude<OrganisationMemberRole, "owner">,
  ): Promise<void>;
  removeMember(organisationId: string, userId: string): Promise<void>;
}
