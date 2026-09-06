import type { OrganisationRepository } from "../repositories/organisation-repository";
import { parseOrganisationProfile } from "../schemas/organisation-profile";

export async function createOrganisation(
  repository: OrganisationRepository,
  input: { actorId: string; body: unknown },
) {
  const profile = parseOrganisationProfile(input.body);
  const organisationId = await repository.createWithOwner(
    input.actorId,
    profile,
  );
  return { organisationId };
}
