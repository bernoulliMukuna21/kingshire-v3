import { hasOrganisationPermission } from "../domain/permissions";
import type {
  OrganisationPermission,
} from "../domain/types";
import type { OrganisationRepository } from "../repositories/organisation-repository";

export async function requireOrganisationPermission(
  repository: OrganisationRepository,
  organisationId: string,
  userId: string,
  permission: OrganisationPermission,
) {
  const membership = await repository.findMembership(organisationId, userId);
  return membership &&
    hasOrganisationPermission(membership.role, permission)
    ? membership
    : null;
}
