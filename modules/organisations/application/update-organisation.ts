import { OrganisationError } from "../domain/errors";
import type { OrganisationRepository } from "../repositories/organisation-repository";
import { parseOrganisationProfile } from "../schemas/organisation-profile";
import { requireOrganisationPermission } from "./permissions";

export async function updateOrganisation(
  repository: OrganisationRepository,
  input: { organisationId: string; actorId: string; body: unknown },
) {
  const membership = await requireOrganisationPermission(
    repository,
    input.organisationId,
    input.actorId,
    "manage_organisation",
  );
  if (!membership) {
    throw new OrganisationError("forbidden", "Forbidden");
  }
  await repository.updateProfile(
    input.organisationId,
    parseOrganisationProfile(input.body),
  );
}

export async function transferOrganisationOwnership(
  repository: OrganisationRepository,
  input: {
    organisationId: string;
    actorId: string;
    newOwnerId: string;
  },
) {
  const membership = await requireOrganisationPermission(
    repository,
    input.organisationId,
    input.actorId,
    "delete_organisation",
  );
  if (!membership) {
    throw new OrganisationError(
      "forbidden",
      "Only the Owner can transfer ownership.",
    );
  }
  if (!input.newOwnerId || input.newOwnerId === input.actorId) {
    throw new OrganisationError(
      "invalid_input",
      "Select another Organisation member.",
    );
  }
  await repository.transferOwnership(
    input.organisationId,
    input.actorId,
    input.newOwnerId,
  );
}

export async function deleteOrganisation(
  repository: OrganisationRepository,
  input: { organisationId: string; actorId: string },
) {
  const membership = await requireOrganisationPermission(
    repository,
    input.organisationId,
    input.actorId,
    "delete_organisation",
  );
  if (!membership) {
    throw new OrganisationError(
      "forbidden",
      "Only the Owner can delete the Organisation.",
    );
  }
  await repository.deleteIfAllowed(input.organisationId, input.actorId);
}
